import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/server";
import { notificationFeed } from "@/lib/notification-feed";
export const dynamic = "force-dynamic";
async function identity(request: Request) {
  const db = adminDb(),
    header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) throw Error("unauthenticated");
  try {
    const token = await getAuth().verifyIdToken(header.slice(7), true);
    return { db, uid: token.uid };
  } catch {
    throw Error("unauthenticated");
  }
}
function failure(error: unknown) {
  if (error instanceof Error && error.message === "unauthenticated")
    return NextResponse.json(
      { error: "Sign in to see your notifications." },
      { status: 401 },
    );
  console.error("Notifications:", error);
  return NextResponse.json(
    { error: "Notifications are unavailable. Try again shortly." },
    { status: 503 },
  );
}
export async function GET(request: Request) {
  try {
    const { db, uid } = await identity(request);
    return NextResponse.json(await notificationFeed(db, uid), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const { db, uid } = await identity(request);
    const body = await request.text();
    if (body.length > 1000)
      return NextResponse.json(
        { error: "Request too large." },
        { status: 413 },
      );
    let input: { through?: number; id?: string };
    try {
      input = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    if (!input || typeof input !== "object" || Array.isArray(input))
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const { through, id } = input;
    const validId =
      typeof id === "string" &&
      id.length <= 400 &&
      /^(message|reply|review)-/.test(id) &&
      through === undefined;
    const validThrough =
      typeof through === "number" &&
      Number.isFinite(through) &&
      through >= 0 &&
      through <= Date.now() &&
      id === undefined;
    if (!validId && !validThrough)
      return NextResponse.json(
        { error: "Invalid notification." },
        { status: 400 },
      );
    const target = db
      .collection("users")
      .doc(uid)
      .collection("preferences")
      .doc("notifications");
    await db.runTransaction(async (tx) => {
      const previous = await tx.get(target),
        state = previous.data() || {};
      const readIds: string[] = Array.isArray(state.readIds)
        ? state.readIds
        : [];
      tx.set(target, {
        lastReadAt:
          typeof through === "number"
            ? Math.max(Number(state.lastReadAt) || 0, through)
            : Number(state.lastReadAt) || 0,
        readIds:
          typeof id === "string"
            ? [...new Set([...readIds, id])].slice(-100)
            : readIds,
      });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
