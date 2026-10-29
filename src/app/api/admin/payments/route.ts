import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { randomUUID } from "node:crypto";
import { adminDb } from "@/lib/server";
import {
  paymentContext,
  paymentEnvironment,
  collectionName,
  PaymentError,
  validReference,
  publicOrder,
  verifyPromotion,
} from "@/lib/payments";
import { boundedText, RequestBodyError } from "@/lib/request-body";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
async function run(request: Request) {
  try {
    const db = adminDb(),
      header = request.headers.get("authorization");
    if (!header?.startsWith("Bearer "))
      throw new PaymentError("Sign in first.", 401);
    let token;
    try {
      token = await getAuth().verifyIdToken(header.slice(7), true);
    } catch {
      throw new PaymentError("Sign in again.", 401);
    }
    if (token.admin !== true)
      throw new PaymentError("Administrator access required.", 403);
    const environment = paymentEnvironment(),
      orders = db.collection(collectionName("paymentOrders", environment));
    if (request.method === "GET") {
      const cursor = new URL(request.url).searchParams.get("after");
      let q = orders
        .where("reviewRequired", "==", true)
        .orderBy("updatedAt", "asc");
      if (cursor) {
        if (!validReference(cursor, environment))
          throw new PaymentError("Invalid review cursor.");
        const doc = await orders.doc(cursor).get();
        if (!doc.exists || !doc.data()?.reviewRequired)
          throw new PaymentError("Review cursor changed.");
        q = q.startAfter(doc);
      }
      const snap = await q.limit(26).get();
      return NextResponse.json(
        {
          environment,
          orders: snap.docs
            .slice(0, 25)
            .map((d) => ({ ...publicOrder(d.data()), uid: d.data().uid })),
          next: snap.size > 25 ? snap.docs[24].id : null,
        },
        { headers },
      );
    }
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      throw new PaymentError("Invalid request origin.", 403);
    let input;
    try {
      input = JSON.parse(await boundedText(request, 3000));
    } catch (error) {
      if (error instanceof RequestBodyError) throw error;
      throw new PaymentError("Invalid review request.");
    }
    if (
      !input ||
      Array.isArray(input) ||
      Object.keys(input).some(
        (k) => !["reference", "action", "note"].includes(k),
      ) ||
      !validReference(input.reference, environment)
    )
      throw new PaymentError("Invalid review request.");
    if (input.action === "verify")
      return NextResponse.json(
        await verifyPromotion(await paymentContext(), input.reference),
        { headers },
      );
    if (
      !["note", "refund_required", "close"].includes(input.action) ||
      typeof input.note !== "string" ||
      input.note.trim().length < 5 ||
      input.note.length > 1000
    )
      throw new PaymentError("Enter a review note.");
    const ref = orders.doc(input.reference);
    await db.runTransaction(async (tx) => {
      const order = await tx.get(ref);
      if (!order.exists) throw new PaymentError("Order not found.", 404);
      if (
        input.action === "close" &&
        !["refunded", "failed", "cancelled", "abandoned"].includes(
          order.data()?.status,
        )
      )
        throw new PaymentError(
          "A paid undelivered/reversed order must remain in review until resolved.",
          409,
        );
      tx.create(ref.collection("events").doc(randomUUID()), {
        kind: "admin_review",
        actorId: token.uid,
        action: input.action,
        note: input.note.trim(),
        at: Date.now(),
      });
      tx.update(ref, {
        updatedAt: Date.now(),
        ...(input.action === "close"
          ? { reviewRequired: false }
          : input.action === "refund_required"
            ? { reviewRequired: true, reviewReason: "refund_required" }
            : {}),
      });
    });
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof PaymentError || error instanceof RequestBodyError
            ? error.message
            : "Payment review unavailable.",
      },
      {
        status:
          error instanceof PaymentError || error instanceof RequestBodyError
            ? error.status
            : 503,
        headers,
      },
    );
  }
}
export const GET = run,
  POST = run;
