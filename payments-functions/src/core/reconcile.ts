import { collectionName } from "./catalogue.js";
import {
  verifyPromotion,
  eligible,
  type PaymentContext,
} from "./promotions.js";
import { processWebhook } from "./webhooks.js";
/** Bounded scheduled recovery. Exceptions leave durable records for the next run. */
export async function reconcilePayments(c: PaymentContext, now = Date.now()) {
  let failures = 0;
  const receipts = await c.db
    .collection(collectionName("paymentWebhookEvents", c.environment))
    .where("status", "==", "pending")
    .where("nextCheckAt", "<=", now)
    .orderBy("nextCheckAt")
    .limit(50)
    .get();
  for (const doc of receipts.docs)
    try {
      await processWebhook(c, doc.id);
    } catch {
      failures++;
    }
  const orders = await c.db
    .collection(collectionName("paymentOrders", c.environment))
    .where("reconcile", "==", true)
    .where("nextCheckAt", "<=", now)
    .orderBy("nextCheckAt")
    .limit(50)
    .get();
  for (const doc of orders.docs)
    try {
      await verifyPromotion(c, doc.id, undefined, now);
    } catch {
      failures++;
      await doc.ref.update({
        nextCheckAt: now + 900000,
        lastError: "reconciliation_failed",
        updatedAt: now,
        ...(now - doc.data().createdAt > 7 * 86400000
          ? {
              reconcile: false,
              reviewRequired: true,
              reviewReason: "verification_unavailable",
            }
          : {}),
      });
    }
  const promotions = await c.db
    .collection(collectionName("listingPromotions", c.environment))
    .where("featuredActive", "==", true)
    .where("featuredUntil", "<=", now)
    .orderBy("featuredUntil")
    .limit(100)
    .get();
  for (const doc of promotions.docs)
    await c.db.runTransaction(async (tx) => {
      const current = await tx.get(doc.ref);
      if (current.data()?.featuredUntil <= now)
        tx.update(doc.ref, { featuredActive: false, updatedAt: now });
    });
  // Visibility readers independently check current listing status/time. No scheduler
  // timing is required to stop a sold or expired advert appearing as a paid placement.
  const active = await c.db
    .collection(collectionName("listingPromotions", c.environment))
    .where("featuredActive", "==", true)
    .orderBy("updatedAt")
    .limit(50)
    .get();
  for (const doc of active.docs) {
    const p = doc.data(),
      listing = await c.db.doc(`listings/${p.listingId}`).get();
    if (!eligible(listing.data()) || listing.data()?.ownerId !== p.uid)
      await doc.ref.update({
        featuredActive: false,
        bumpActive: false,
        updatedAt: now,
        suspendedReason: "listing_unavailable",
      });
  }
  return {
    failures,
    orders: orders.size,
    events: receipts.size,
    expired: promotions.size,
  };
}
