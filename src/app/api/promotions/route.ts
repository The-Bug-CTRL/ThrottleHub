import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/server";
import { boundedText, RequestBodyError } from "@/lib/request-body";
import {
  paymentContext,
  paymentEnvironment,
  paymentsEnabled,
  paymentCallbackUrl,
  PRODUCTS,
  PaymentError,
  bumpCooldownMs,
  collectionName,
  validId,
  validReference,
  initializePromotion,
  verifyPromotion,
  cancelPromotion,
  entitlementRef,
  publicOrder,
} from "@/lib/payments";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
async function identity(request: Request) {
  const db = adminDb(),
    header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer "))
    throw new PaymentError("Sign in first.", 401);
  try {
    return { db, token: await getAuth().verifyIdToken(header.slice(7), true) };
  } catch {
    throw new PaymentError("Sign in again.", 401);
  }
}
function failure(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof PaymentError || error instanceof RequestBodyError
          ? error.message
          : "Promotions are temporarily unavailable. No payment has been confirmed here.",
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
export async function GET(request: Request) {
  try {
    const { db, token } = await identity(request),
      environment = paymentEnvironment(),
      url = new URL(request.url),
      listingId = url.searchParams.get("listingId");
    const reference = url.searchParams.get("reference");
    if (reference) {
      if (!validReference(reference, environment))
        throw new PaymentError("Invalid payment reference.");
      const order = await db
        .collection(collectionName("paymentOrders", environment))
        .doc(reference)
        .get();
      if (!order.exists || order.data()?.uid !== token.uid)
        throw new PaymentError("Payment order not found.", 404);
      return NextResponse.json(
        { order: publicOrder(order.data()!), environment },
        { headers },
      );
    }
    if (listingId === null) {
      let history = db
        .collection(collectionName("paymentOrders", environment))
        .where("uid", "==", token.uid)
        .orderBy("createdAt", "desc");
      const after = url.searchParams.get("after");
      if (after) {
        if (!validReference(after, environment))
          throw new PaymentError("Invalid history cursor.");
        const cursor = await db
          .collection(collectionName("paymentOrders", environment))
          .doc(after)
          .get();
        if (!cursor.exists || cursor.data()?.uid !== token.uid)
          throw new PaymentError("Invalid history cursor.");
        history = history.startAfter(cursor);
      }
      const orders = await history.limit(21).get();
      return NextResponse.json(
        {
          environment,
          orders: orders.docs.slice(0, 20).map((d) => publicOrder(d.data())),
          next: orders.size > 20 ? orders.docs[19].id : null,
        },
        { headers },
      );
    }
    if (!validId(listingId)) throw new PaymentError("Choose a listing.");
    const cursor = url.searchParams.get("after");
    if (cursor && !validReference(cursor, environment))
      throw new PaymentError("Invalid history cursor.");
    let query = db
      .collection(collectionName("paymentOrders", environment))
      .where("uid", "==", token.uid)
      .where("listingId", "==", listingId)
      .orderBy("createdAt", "desc");
    if (cursor) {
      const doc = await db
        .collection(collectionName("paymentOrders", environment))
        .doc(cursor)
        .get();
      if (
        !doc.exists ||
        doc.data()?.uid !== token.uid ||
        doc.data()?.listingId !== listingId
      )
        throw new PaymentError("Invalid history cursor.");
      query = query.startAfter(doc);
    }
    const [listing, orders, promotion] = await Promise.all([
      db.doc(`listings/${listingId}`).get(),
      query.limit(21).get(),
      entitlementRef(db, environment, listingId).get(),
    ]);
    if (listing.data()?.ownerId !== token.uid && orders.empty)
      throw new PaymentError("You can only view your own promotions.", 403);
    const p = listing.data()?.ownerId === token.uid ? promotion.data() : null;
    return NextResponse.json(
      {
        environment,
        enabled: paymentsEnabled(),
        products: Object.values(PRODUCTS).filter((p) => p.enabled),
        bumpCooldownHours: bumpCooldownMs() / 3600000,
        orders: orders.docs.slice(0, 20).map((d) => publicOrder(d.data())),
        next: orders.size > 20 ? orders.docs[19].id : null,
        promotion: p
          ? {
              bumpEligibleAt:
                p.bumpCooldownUntil ||
                (p.bumpedAt ? p.bumpedAt + bumpCooldownMs() : null),
              featuredUntil:
                p.featuredActive &&
                p.featuredUntil > Date.now() &&
                listing.data()?.status === "published"
                  ? p.featuredUntil
                  : null,
              bumpedAt:
                p.bumpActive && listing.data()?.status === "published"
                  ? p.bumpedAt
                  : null,
            }
          : null,
      },
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const { token } = await identity(request),
      origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      throw new PaymentError("Invalid request origin.", 403);
    let input;
    try {
      input = JSON.parse(await boundedText(request, 3000));
    } catch (error) {
      if (error instanceof RequestBodyError) throw error;
      throw new PaymentError("Invalid promotion request.");
    }
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new PaymentError("Invalid promotion request.");
    if (!["initialize", "verify", "cancel"].includes(input.action))
      throw new PaymentError("Choose a promotion action.");
    const allowed =
      input.action === "initialize"
        ? ["action", "listingId", "sku"]
        : ["action", "reference"];
    if (Object.keys(input).some((k) => !allowed.includes(k)))
      throw new PaymentError("Unexpected promotion fields.");
    const c = await paymentContext(input.action === "initialize");
    if (input.action === "initialize") {
      const user = await getAuth().getUser(token.uid);
      if (!user.email)
        throw new PaymentError("Add an account email before checkout.");
      return NextResponse.json(
        await initializePromotion(
          c,
          token.uid,
          user.email,
          input.listingId,
          input.sku,
          paymentCallbackUrl(),
        ),
        { headers },
      );
    }
    return NextResponse.json(
      await (input.action === "verify"
        ? verifyPromotion(c, input.reference, token.uid)
        : cancelPromotion(c, token.uid, input.reference)),
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}
