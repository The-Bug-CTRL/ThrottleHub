import { createHash, randomBytes } from "node:crypto";
import type { Firestore, DocumentData } from "firebase-admin/firestore";
import {
  PaymentError,
  product,
  collectionName,
  bumpCooldownMs,
  validId,
  validReference,
  assertLiveEnabled,
  type PaymentEnvironment,
} from "./catalogue.js";
import {
  emailHash,
  checkoutUrl,
  type PaymentProvider,
  type VerifiedPayment,
} from "./paystack.js";
export const promotionId = (listingId: string) =>
  createHash("sha256").update(listingId).digest("hex");
export const eligible = (listing: DocumentData | undefined) =>
  !!listing &&
  listing.status === "published" &&
  listing.country === "ZA" &&
  listing.currency === "ZAR" &&
  !!listing.ownerId;
function coolingDown(p: DocumentData | undefined, now: number) {
  return p?.bumpCooldownUntil
    ? p.bumpCooldownUntil > now
    : p?.bumpedAt > now - bumpCooldownMs();
}
export type PaymentContext = {
  db: Firestore;
  environment: PaymentEnvironment;
  provider: PaymentProvider;
};
export function orderRef(c: PaymentContext, reference: string) {
  if (!validReference(reference, c.environment))
    throw new PaymentError("Invalid payment reference.");
  return c.db
    .collection(collectionName("paymentOrders", c.environment))
    .doc(reference);
}
export function entitlementRef(
  db: Firestore,
  env: PaymentEnvironment,
  listingId: string,
) {
  return db
    .collection(collectionName("listingPromotions", env))
    .doc(promotionId(listingId));
}
function owned(listing: DocumentData | undefined, uid: string) {
  if (!listing || listing.ownerId !== uid)
    throw new PaymentError("You can only promote your own listing.", 403);
  if (!eligible(listing))
    throw new PaymentError(
      "Only published South African listings can be promoted.",
      409,
    );
}
export async function initializePromotion(
  c: PaymentContext,
  uid: string,
  email: string,
  listingId: string,
  sku: unknown,
  callbackUrl: string,
  now = Date.now(),
) {
  assertLiveEnabled(c.environment);
  if (!validId(uid) || !validId(listingId) || !email || email.length > 254)
    throw new PaymentError("A valid seller account and listing are required.");
  const selected = product(sku),
    reference = `th-${c.environment}-${randomBytes(24).toString("hex")}`;
  const lock = c.db
    .collection(collectionName("paymentLocks", c.environment))
    .doc(promotionId(listingId));
  const quota = c.db
    .collection(collectionName("paymentLimits", c.environment))
    .doc(uid);
  const created = await c.db.runTransaction(async (tx) => {
    const [listing, restriction, current, limit, promotion] = await Promise.all(
      [
        tx.get(c.db.doc(`listings/${listingId}`)),
        tx.get(c.db.doc(`restrictions/${uid}`)),
        tx.get(lock),
        tx.get(quota),
        tx.get(entitlementRef(c.db, c.environment, listingId)),
      ],
    );
    owned(listing.data(), uid);
    if (restriction.data()?.suspended === true)
      throw new PaymentError("This account cannot purchase promotions.", 403);
    if (current.data()?.until > now) {
      const pending = await tx.get(orderRef(c, current.data()!.reference));
      if (pending.data()?.uid !== uid)
        throw new PaymentError(
          "Another checkout is pending for this listing.",
          409,
        );
      if (pending.data()?.sku !== selected.sku)
        throw new PaymentError(
          "Finish or cancel the existing checkout first.",
          409,
        );
      if (pending.data()?.amount !== selected.amount)
        throw new PaymentError(
          "The product price changed. Cancel the old checkout before purchasing again.",
          409,
        );
      return {
        reference: pending.id,
        url: pending.data()?.checkoutUrl || null,
        reused: true,
      };
    }
    const active = promotion.data();
    if (selected.sku === "bump" && coolingDown(active, now))
      throw new PaymentError(
        "This listing is still in its paid-bump cooldown.",
        409,
      );
    if (
      selected.sku !== "bump" &&
      active?.featuredUntil > now &&
      active?.featuredActive
    )
      throw new PaymentError(
        "This listing is already featured. Wait until its placement ends.",
        409,
      );
    const count =
      limit.data()?.windowAt > now - 3600000 ? limit.data()!.count : 0;
    if (count >= 6)
      throw new PaymentError(
        "Too many checkout attempts. Try again later.",
        429,
      );
    tx.set(quota, {
      windowAt: count ? limit.data()!.windowAt : now,
      count: count + 1,
    });
    tx.create(orderRef(c, reference), {
      reference,
      uid,
      listingId,
      sku: selected.sku,
      productName: selected.name,
      amount: selected.amount,
      durationDays: selected.durationDays,
      bumpCooldownMs: bumpCooldownMs(),
      currency: "ZAR",
      environment: c.environment,
      payerHash: emailHash(email),
      status: "initializing",
      fulfilmentStatus: "pending",
      createdAt: now,
      updatedAt: now,
      checkoutExpiresAt: now + 1200000,
      reconcile: true,
      nextCheckAt: now + 300000,
      verifyAttempts: 0,
      reviewRequired: false,
      revenueCents: 0,
    });
    tx.set(lock, { reference, uid, until: now + 1200000 });
    return { reference, url: null, reused: false };
  });
  if (created.reused) {
    if (!created.url)
      throw new PaymentError(
        "Checkout is being prepared. Retry shortly or check payment history.",
        409,
      );
    return {
      reference: created.reference,
      url: checkoutUrl(created.url),
      reused: true,
      environment: c.environment,
    };
  }
  try {
    const result = await c.provider.initialize({
      reference,
      email,
      amount: selected.amount,
      callbackUrl,
    });
    await c.db.runTransaction(async (tx) => {
      const ref = orderRef(c, reference),
        snap = await tx.get(ref);
      if (
        ["initializing", "initialization_unknown"].includes(snap.data()?.status)
      )
        tx.update(ref, {
          checkoutUrl: checkoutUrl(result.url),
          status: "pending",
          updatedAt: Date.now(),
        });
    });
    return {
      reference,
      url: checkoutUrl(result.url),
      reused: false,
      environment: c.environment,
    };
  } catch (error) {
    await c.db.runTransaction(async (tx) => {
      const ref = orderRef(c, reference),
        snap = await tx.get(ref);
      if (snap.data()?.status === "initializing")
        tx.update(ref, {
          status: "initialization_unknown",
          updatedAt: Date.now(),
          reviewReason: "initialization_uncertain",
        });
    });
    throw error;
  }
}
function matchesPayment(
  order: DocumentData,
  payment: VerifiedPayment,
  env: PaymentEnvironment,
) {
  return (
    payment.reference === order.reference &&
    payment.domain === env &&
    payment.currency === "ZAR" &&
    payment.amount === order.amount &&
    Number.isSafeInteger(payment.amount) &&
    payment.payerHash === order.payerHash &&
    /^\d+$/.test(payment.id)
  );
}
/** Only provider verification enters this transaction, shared by callback, worker and reconciliation. */
export async function verifyPromotion(
  c: PaymentContext,
  reference: string,
  uid?: string,
  now = Date.now(),
) {
  assertLiveEnabled(c.environment);
  const ref = orderRef(c, reference),
    before = await ref.get();
  if (!before.exists) throw new PaymentError("Payment order not found.", 404);
  if (uid && before.data()?.uid !== uid)
    throw new PaymentError("This payment belongs to another account.", 403);
  if (uid)
    await c.db.runTransaction(async (tx) => {
      const ref = c.db
          .collection(
            collectionName("paymentVerificationLimits", c.environment),
          )
          .doc(uid),
        snap = await tx.get(ref),
        previous = snap.data(),
        count = previous?.windowAt > now - 900000 ? previous!.count : 0;
      if (count >= 30)
        throw new PaymentError(
          "Too many verification requests. Wait a few minutes; webhooks will still check completed payments.",
          429,
        );
      tx.set(ref, {
        windowAt: count ? previous!.windowAt : now,
        count: count + 1,
      });
    });
  // Existing fulfilment is still verified on explicit callbacks; no browser success flag is trusted.
  const payment = await c.provider.verify(reference);
  return c.db.runTransaction(async (tx) => {
    const snap = await tx.get(ref),
      order = snap.data()!;
    const listingRef = c.db.doc(`listings/${order.listingId}`),
      promoRef = entitlementRef(c.db, c.environment, order.listingId),
      lock = c.db
        .collection(collectionName("paymentLocks", c.environment))
        .doc(promotionId(order.listingId));
    const transaction = c.db
      .collection(collectionName("paystackTransactions", c.environment))
      .doc(payment.id.match(/^\d+$/) ? payment.id : "invalid");
    const [listing, restriction, promo, pending, mapping] = await Promise.all([
      tx.get(listingRef),
      tx.get(c.db.doc(`restrictions/${order.uid}`)),
      tx.get(promoRef),
      tx.get(lock),
      tx.get(transaction),
    ]);
    if (uid && order.uid !== uid)
      throw new PaymentError("This payment belongs to another account.", 403);
    if (
      !matchesPayment(order, payment, c.environment) ||
      (mapping.exists && mapping.data()?.reference !== reference)
    ) {
      tx.update(ref, {
        reviewRequired: true,
        reviewReason: "verification_mismatch",
        reconcile: false,
        updatedAt: now,
        nextCheckAt: now + 3600000,
      });
      return { status: "review_required", environment: c.environment };
    }
    if (payment.status === "reversed" && !order.reversed) {
      tx.update(ref, {
        status: "reversed",
        reversed: true,
        fulfilmentStatus: "revoked",
        updatedAt: now,
        reviewRequired: true,
        reviewReason: "provider_reversed",
        reconcile: false,
        revenueCents: 0,
      });
      if (promo.exists)
        tx.update(promoRef, {
          ...(promo.data()?.featuredReference === reference
            ? { featuredActive: false }
            : {}),
          ...(promo.data()?.bumpReference === reference
            ? { bumpActive: false }
            : {}),
          updatedAt: now,
        });
      return { status: "reversed", environment: c.environment };
    }
    if (order.reversed || order.fulfilledAt)
      return {
        status: order.status,
        environment: c.environment,
        featuredUntil: order.featuredUntil || null,
      };
    if (payment.status !== "success") {
      const terminal = ["failed", "abandoned", "reversed"].includes(
          payment.status,
        ),
        overdue = now - order.createdAt > 7 * 86400000;
      tx.update(ref, {
        status: terminal
          ? payment.status
          : now > order.checkoutExpiresAt
            ? "abandoned"
            : "pending",
        updatedAt: now,
        verifyAttempts: (order.verifyAttempts || 0) + 1,
        reconcile: !overdue,
        nextCheckAt: now + (terminal ? 3600000 : 300000),
        ...(overdue
          ? { reviewRequired: true, reviewReason: "payment_unresolved" }
          : {}),
      });
      return {
        status: terminal ? payment.status : "pending",
        environment: c.environment,
      };
    }
    const p = promo.data();
    let reason = "";
    if (
      !eligible(listing.data()) ||
      listing.data()?.ownerId !== order.uid ||
      restriction.data()?.suspended
    )
      reason = "listing_unavailable";
    else if (order.sku === "bump" && coolingDown(p, now))
      reason = "bump_cooldown";
    else if (
      order.sku !== "bump" &&
      p?.featuredActive &&
      p?.featuredUntil > now
    )
      reason = "featured_already_active";
    if (pending.data()?.reference === reference)
      tx.set(lock, { ...pending.data(), until: 0 });
    tx.set(transaction, {
      reference,
      uid: order.uid,
      listingId: order.listingId,
      verifiedAt: now,
    });
    if (reason) {
      tx.update(ref, {
        status: "paid_needs_review",
        fulfilmentStatus: "unavailable",
        transactionId: payment.id,
        paidAt: payment.paidAt,
        verifiedAt: now,
        updatedAt: now,
        reviewRequired: true,
        reviewReason: reason,
        reconcile: false,
        revenueCents: 0,
      });
      return { status: "paid_needs_review", environment: c.environment };
    }
    const feature = order.sku !== "bump",
      featuredUntil = feature ? now + order.durationDays * 86400000 : null;
    tx.set(
      promoRef,
      {
        listingId: order.listingId,
        uid: order.uid,
        environment: c.environment,
        updatedAt: now,
        ...(feature
          ? {
              featuredActive: true,
              featuredUntil,
              featuredReference: reference,
            }
          : {
              bumpActive: true,
              bumpedAt: now,
              bumpReference: reference,
              bumpCooldownUntil:
                now + (order.bumpCooldownMs || bumpCooldownMs()),
            }),
      },
      { merge: true },
    );
    tx.create(
      c.db
        .collection(collectionName("promotionPurchases", c.environment))
        .doc(reference),
      {
        reference,
        uid: order.uid,
        listingId: order.listingId,
        sku: order.sku,
        amount: order.amount,
        currency: "ZAR",
        environment: c.environment,
        fulfilledAt: now,
        featuredUntil,
        bumpedAt: feature ? null : now,
      },
    );
    tx.update(ref, {
      status: "fulfilled",
      fulfilmentStatus: "active",
      transactionId: payment.id,
      paidAt: payment.paidAt,
      fulfilledAt: now,
      featuredUntil,
      updatedAt: now,
      reconcile: false,
      reviewRequired: false,
      revenueCents: c.environment === "live" ? order.amount : 0,
    });
    return { status: "fulfilled", environment: c.environment, featuredUntil };
  });
}
export async function cancelPromotion(
  c: PaymentContext,
  uid: string,
  reference: string,
) {
  const ref = orderRef(c, reference);
  return c.db.runTransaction(async (tx) => {
    const snap = await tx.get(ref),
      o = snap.data();
    if (!o || o.uid !== uid)
      throw new PaymentError("Payment order not found.", 404);
    const lock = c.db
        .collection(collectionName("paymentLocks", c.environment))
        .doc(promotionId(o.listingId)),
      pending = await tx.get(lock);
    if (o.fulfilledAt || o.verifiedAt || o.reversed)
      throw new PaymentError("This payment cannot be cancelled here.", 409);
    tx.update(ref, { status: "cancelled", updatedAt: Date.now() });
    if (pending.data()?.reference === reference) tx.update(lock, { until: 0 });
    return { status: "cancelled" };
  });
}
export function publicOrder(o: DocumentData) {
  return Object.fromEntries(
    [
      "reference",
      "listingId",
      "sku",
      "productName",
      "amount",
      "currency",
      "environment",
      "status",
      "fulfilmentStatus",
      "createdAt",
      "updatedAt",
      "featuredUntil",
      "fulfilledAt",
      "reviewRequired",
      "reviewReason",
    ]
      .filter((k) => o[k] !== undefined)
      .map((k) => [k, o[k]]),
  );
}
