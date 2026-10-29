import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getAppCheck } from "firebase-admin/app-check";
import { getStorage } from "firebase-admin/storage";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { adminDb } from "@/lib/server";
import {
  boundedBytes,
  boundedText,
  RequestBodyError,
} from "@/lib/request-body";
import { sanitizePhoto } from "@/lib/photo-service";
import { ListingError } from "@/lib/listing-lifecycle";
import {
  assertSupportAccess,
  SupportError,
  supportMutation,
  supportQuota,
} from "@/lib/support-service";
import type { SupportActor } from "@/lib/support-model";
import { supportDiagnostic } from "@/lib/support-diagnostics";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
async function identity(request: Request): Promise<SupportActor> {
  adminDb();
  const bearer = request.headers.get("authorization") || "";
  if (bearer.startsWith("Bearer ")) {
    try {
      const token = await getAuth().verifyIdToken(bearer.slice(7), true);
      return { uid: token.uid, admin: token.admin === true };
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (
        [
          "auth/id-token-expired",
          "auth/id-token-revoked",
          "auth/argument-error",
          "auth/invalid-id-token",
          "auth/user-disabled",
          "auth/user-not-found",
        ].includes(code || "")
      )
        throw new SupportError("Please sign in again.", 401);
      // IAM/credential/service failures are not invalid customer passwords.
      throw error;
    }
  }
  const credential = request.headers.get("x-support-access") || "";
  if (/^[a-f0-9]{64}$/.test(credential)) {
    const uid = `guest-${createHash("sha256").update(credential).digest("hex")}`;
    const grant = await adminDb().doc(`supportGuests/${uid}`).get();
    if (!grant.exists || grant.data()!.expiresAt <= Date.now())
      throw new SupportError("Guest access has expired or is invalid.", 401);
    return {
      uid,
      admin: false,
      guest: true,
    };
  }
  throw new SupportError("Sign in to contact support.", 401);
}
function failure(error: unknown, stage = "support-mutation") {
  const known =
    error instanceof SupportError ||
    error instanceof RequestBodyError ||
    error instanceof ListingError;
  if (!known && !(error instanceof ZodError) && !(error instanceof SyntaxError))
    console.error("[Support]", supportDiagnostic(stage, error));
  return NextResponse.json(
    {
      error: known
        ? error.message
        : error instanceof ZodError || error instanceof SyntaxError
          ? "Check the request fields."
          : "Support is unavailable. Please try again.",
    },
    {
      status: known
        ? error.status
        : error instanceof ZodError || error instanceof SyntaxError
          ? 400
          : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
const json = (data: unknown) =>
  NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET(request: Request) {
  let stage = "identity/admin-initialization";
  try {
    const actor = await identity(request),
      db = adminDb(),
      url = new URL(request.url),
      id = url.searchParams.get("id");
    stage = "ticket-detail";
    if (id) {
      if (!/^TH-[A-F0-9]{24}$/.test(id))
        throw new SupportError("Request not found.", 404);
      const ref = db.doc(`supportTickets/${id}`),
        snap = await ref.get();
      assertSupportAccess(actor, snap.data());
      const attachment = url.searchParams.get("attachment");
      if (attachment) {
        if (!/^[a-f0-9-]{36}$/.test(attachment))
          throw new SupportError("Image not found.", 404);
        const meta = await ref.collection("attachments").doc(attachment).get();
        if (!meta.exists || meta.data()?.ready !== true)
          throw new SupportError("Image not found.", 404);
        const [bytes] = await getStorage()
          .bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)
          .file(`support-images/${id}/${attachment}.jpg`)
          .download();
        return new Response(new Uint8Array(bytes), {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": "inline; filename=support-image.jpg",
          },
        });
      }
      const section = url.searchParams.get("section") || "messages";
      if (
        !["messages", "notes", "activity"].includes(section) ||
        (!actor.admin && section !== "messages")
      )
        throw new SupportError("Not permitted.", 403);
      let q = ref
        .collection(section)
        .orderBy("createdAt", "desc")
        .orderBy("__name__", "desc")
        .limit(30);
      const after = url.searchParams.get("after");
      if (after) {
        if (!/^[a-zA-Z0-9_-]{1,128}$/.test(after))
          throw new SupportError("Invalid page.");
        const cursor = await ref.collection(section).doc(after).get();
        if (!cursor.exists) throw new SupportError("Invalid page.");
        q = q.startAfter(cursor);
      }
      const [messages, attachments] = await Promise.all([
        q.get(),
        ref
          .collection("attachments")
          .where("ready", "==", true)
          .limit(12)
          .get(),
      ]);
      const profile =
        actor.admin && !snap.data()?.guest
          ? (await db.doc(`profiles/${snap.data()!.ownerId}`).get()).data()
          : undefined;
      return json({
        ticket: {
          ...snap.data(),
          id,
          ...(profile
            ? {
                customer: {
                  displayName: profile.displayName || "Rider",
                  accountType: profile.accountType || "personal",
                  region: profile.region || "",
                  city: profile.city || "",
                },
              }
            : {}),
        },
        items: messages.docs.map((d) => ({ ...d.data(), id: d.id })),
        next: messages.size === 30 ? messages.docs.at(-1)!.id : null,
        attachments: attachments.docs.map((d) => ({ id: d.id })),
      });
    }
    let q = db.collection("supportTickets").limit(30);
    if (!actor.admin) q = q.where("ownerId", "==", actor.uid);
    else
      for (const field of ["status", "category", "priority", "ownerId"]) {
        const value = url.searchParams.get(field);
        if (value && value.length <= 160) q = q.where(field, "==", value);
      }
    const sort =
      url.searchParams.get("sort") === "oldest" ? "waitingSince" : "updatedAt";
    if (
      actor.admin &&
      sort === "waitingSince" &&
      !url.searchParams.has("status")
    )
      q = q.where("status", "in", ["new", "waiting-staff"]);
    q = q
      .orderBy(sort, sort === "waitingSince" ? "asc" : "desc")
      .orderBy("__name__", "desc");
    const after = url.searchParams.get("after");
    if (after) {
      if (!/^TH-[A-F0-9]{24}$/.test(after))
        throw new SupportError("Invalid page.");
      const cursor = await db.doc(`supportTickets/${after}`).get();
      assertSupportAccess(actor, cursor.data());
      q = q.startAfter(cursor);
    }
    stage = actor.admin
      ? "staff-list: supportTickets filters + updatedAt/waitingSince + documentId DESC limit30"
      : `customer-list: supportTickets ownerId == uid + ${sort} ${sort === "waitingSince" ? "ASC" : "DESC"} + documentId DESC limit30`;
    const snap = await q.get();
    return json({
      items: snap.docs.map((d) => ({ ...d.data(), id: d.id })),
      next: snap.size === 30 ? snap.docs.at(-1)!.id : null,
    });
  } catch (e) {
    return failure(e, stage);
  }
}
export async function POST(request: Request) {
  try {
    const db = adminDb(),
      url = new URL(request.url);
    let actor: SupportActor, credential: string | undefined;
    if (url.searchParams.get("guest") === "create") {
      // Fail closed: enable only after configuring App Check on the web app.
      if (process.env.SUPPORT_GUEST_ENABLED !== "true")
        throw new SupportError(
          "Guest support is not enabled yet. Try password reset or contact the site operator.",
          503,
        );
      try {
        const checked = await getAppCheck().verifyToken(
          request.headers.get("x-firebase-appcheck") || "",
          { consume: true },
        );
        if (checked.alreadyConsumed) throw Error("Replayed token");
      } catch {
        throw new SupportError(
          "Security check failed. Refresh and try again.",
          403,
        );
      }
      await supportQuota(db, "guest-global", 20);
      credential = randomBytes(32).toString("hex");
      actor = {
        uid: `guest-${createHash("sha256").update(credential).digest("hex")}`,
        guest: true,
        admin: false,
      };
    } else actor = await identity(request);
    const input = JSON.parse(await boundedText(request, 10000));
    if (credential && input.action !== "create")
      throw new SupportError("Invalid request.");
    if (actor.guest && !credential && input.action === "create")
      throw new SupportError("Use the protected guest form.", 403);
    const result = await supportMutation(db, actor, input);
    if (credential)
      await db
        .doc(`supportGuests/${actor.uid}`)
        .create({ expiresAt: Date.now() + 90 * 86400000, ticketId: result.id });
    return json({
      ...result,
      ...(credential ? { credential } : {}),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(request: Request) {
  try {
    const actor = await identity(request),
      db = adminDb(),
      id = new URL(request.url).searchParams.get("id") || "";
    if (!/^TH-[A-F0-9]{24}$/.test(id))
      throw new SupportError("Invalid request.");
    const ref = db.doc(`supportTickets/${id}`);
    assertSupportAccess(actor, (await ref.get()).data());
    await supportQuota(db, `${actor.uid}-uploads`, 12);
    const attachment = randomUUID(),
      record = ref.collection("attachments").doc(attachment);
    await db.runTransaction(async (tx) => {
      const ticket = (await tx.get(ref)).data();
      assertSupportAccess(actor, ticket);
      if (ticket!.status === "resolved" || ticket!.attachmentCount >= 12)
        throw new SupportError(
          "Reopen the ticket or remove the extra images. Maximum 12 screenshots per ticket.",
        );
      tx.update(ref, { attachmentCount: ticket!.attachmentCount + 1 });
      tx.create(record, {
        ready: false,
        createdAt: Date.now(),
        uploaderId: actor.uid,
      });
    });
    const bytes = await sanitizePhoto(
      await boundedBytes(request, 5 * 1024 * 1024),
    );
    const file = getStorage()
      .bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)
      .file(`support-images/${id}/${attachment}.jpg`);
    await file.save(bytes, {
      resumable: false,
      metadata: {
        contentType: "image/jpeg",
        cacheControl: "private, no-store",
        metadata: {},
      },
    });
    await record.update({ ready: true });
    return json({ id: attachment });
  } catch (e) {
    return failure(e);
  }
}
