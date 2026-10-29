import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import {
  PaymentError,
  collectionName,
  validReference,
  assertLiveEnabled,
  type PaymentEnvironment,
} from "./catalogue.js";
import {
  orderRef,
  entitlementRef,
  verifyPromotion,
  type PaymentContext,
} from "./promotions.js";
const events = new Set([
  "charge.success",
  "refund.pending",
  "refund.processing",
  "refund.processed",
  "refund.failed",
  "charge.dispute.create",
  "charge.dispute.remind",
  "charge.dispute.resolve",
]);
export function verifyWebhookSignature(
  raw: Buffer,
  signature: unknown,
  secret: string,
) {
  if (raw.length > 131072) throw new PaymentError("Webhook too large.", 413);
  if (
    typeof signature !== "string" ||
    !/^[a-f0-9]{128}$/i.test(signature) ||
    secret.length < 16
  )
    throw new PaymentError("Invalid webhook signature.", 401);
  const expected = createHmac("sha512", secret).update(raw).digest(),
    given = Buffer.from(signature, "hex");
  if (!timingSafeEqual(expected, given))
    throw new PaymentError("Invalid webhook signature.", 401);
}
export async function enqueueWebhook(
  db: Firestore,
  env: PaymentEnvironment,
  raw: Buffer,
  signature: unknown,
  secret: string,
) {
  assertLiveEnabled(env);
  if (!secret.startsWith(env === "test" ? "sk_test_" : "sk_live_"))
    throw new PaymentError("Webhook environment is not configured.", 503);
  verifyWebhookSignature(raw, signature, secret);
  let event;
  try {
    event = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new PaymentError("Invalid webhook body.");
  }
  if (!events.has(event?.event)) return { accepted: true, ignored: true };
  const data = event.data || {},
    transaction = event.event === "charge.success" ? data : data.transaction;
  let reference =
    typeof transaction?.reference === "string"
      ? transaction.reference
      : typeof data.transaction_reference === "string"
        ? data.transaction_reference
        : "";
  const transactionId =
    typeof transaction === "number" || typeof transaction === "string"
      ? String(transaction)
      : String(transaction?.id || "");
  if (!reference && /^\d{1,30}$/.test(transactionId))
    reference = String(
      (
        await db
          .collection(collectionName("paystackTransactions", env))
          .doc(transactionId)
          .get()
      ).data()?.reference || "",
    );
  if (reference && !validReference(reference, env))
    return { accepted: true, ignored: true };
  if (!reference && !/^\d{1,30}$/.test(transactionId))
    throw new PaymentError("Transaction identifier missing.");
  const hash = createHash("sha256").update(raw).digest("hex"),
    ref = db.collection(collectionName("paymentWebhookEvents", env)).doc(hash);
  await db.runTransaction(async (tx) => {
    if ((await tx.get(ref)).exists) return;
    // A signed reversal suspends benefits immediately, even if provider verification
    // is temporarily unavailable. Financial confirmation is recorded by the worker.
    if (event.event !== "charge.success" && validReference(reference, env)) {
      const order = db
          .collection(collectionName("paymentOrders", env))
          .doc(reference),
        o = await tx.get(order);
      if (o.exists) {
        const promotion = entitlementRef(db, env, o.data()!.listingId),
          p = await tx.get(promotion);
        tx.update(order, {
          reversed: true,
          status:
            o.data()?.status === "refunded"
              ? "refunded"
              : "reversal_pending_review",
          fulfilmentStatus:
            o.data()?.status === "refunded" ? "revoked" : "suspended",
          reviewRequired: o.data()?.status === "refunded" ? false : true,
          reviewReason: "signed_reversal_pending_verification",
          revenueCents: 0,
          updatedAt: Date.now(),
        });
        if (p.exists)
          tx.update(promotion, {
            ...(p.data()?.featuredReference === reference
              ? { featuredActive: false }
              : {}),
            ...(p.data()?.bumpReference === reference
              ? { bumpActive: false }
              : {}),
            updatedAt: Date.now(),
          });
      }
    }
    tx.create(ref, {
      event: event.event,
      reference,
      transactionId,
      environment: env,
      status: "pending",
      createdAt: Date.now(),
      nextCheckAt: Date.now(),
      attempts: 0,
      ...(Number.isSafeInteger(data.amount)
        ? { eventAmount: data.amount }
        : {}),
    });
  });
  return { accepted: true, eventId: hash };
}
export async function processWebhook(c: PaymentContext, id: string) {
  const receipt = c.db
      .collection(collectionName("paymentWebhookEvents", c.environment))
      .doc(id),
    snap = await receipt.get(),
    event = snap.data();
  if (!event || event.status !== "pending") return;
  try {
    const reference =
      event.reference ||
      (await c.provider.transactionReference(event.transactionId));
    if (
      !validReference(reference, c.environment) ||
      !(await orderRef(c, reference).get()).exists
    ) {
      await receipt.update({ status: "ignored", processedAt: Date.now() });
      return;
    }
    if (event.event === "charge.success") await verifyPromotion(c, reference);
    else {
      const verified = await c.provider.verify(reference);
      await c.db.runTransaction(async (tx) => {
        const ref = orderRef(c, reference),
          o = (await tx.get(ref)).data()!;
        const promoRef = entitlementRef(c.db, c.environment, o.listingId),
          promo = (await tx.get(promoRef)).data();
        const audit = ref.collection("events").doc(id),
          prior = await tx.get(audit);
        if (prior.exists) return;
        if (
          verified.reference !== reference ||
          verified.domain !== c.environment ||
          verified.amount !== o.amount ||
          verified.currency !== o.currency ||
          verified.payerHash !== o.payerHash ||
          (event.transactionId && verified.id !== event.transactionId)
        )
          throw new PaymentError("Reversal transaction mismatch.");
        const refund = event.event.startsWith("refund."),
          processed = event.event === "refund.processed",
          fullRefund =
            o.status === "refunded" ||
            (processed && event.eventAmount === o.amount);
        const status = fullRefund
          ? "refunded"
          : processed
            ? "refund_processed_review"
            : refund
              ? event.event === "refund.failed"
                ? "refund_failed_review"
                : "refund_pending"
              : event.event === "charge.dispute.resolve"
                ? "dispute_resolved_review"
                : "disputed";
        tx.update(ref, {
          status,
          reversed: true,
          fulfilmentStatus: "revoked",
          updatedAt: Date.now(),
          reviewRequired: !fullRefund,
          reviewReason: event.event,
          reconcile: false,
          revenueCents: 0,
        });
        tx.create(audit, {
          kind: event.event,
          at: Date.now(),
          ...(event.eventAmount !== undefined
            ? { amount: event.eventAmount }
            : {}),
        });
        if (promo)
          tx.update(promoRef, {
            ...(promo.featuredReference === reference
              ? { featuredActive: false }
              : {}),
            ...(promo.bumpReference === reference ? { bumpActive: false } : {}),
            updatedAt: Date.now(),
          });
      });
    }
    await receipt.update({
      status: "processed",
      reference,
      processedAt: Date.now(),
    });
  } catch (error) {
    await receipt.update({
      attempts: (event.attempts || 0) + 1,
      status: (event.attempts || 0) >= 19 ? "needs_review" : "pending",
      nextCheckAt: Date.now() + 300000,
      lastError: "processing_failed",
    });
    if (
      (event.attempts || 0) >= 19 &&
      validReference(event.reference, c.environment)
    ) {
      const order = orderRef(c, event.reference);
      if ((await order.get()).exists)
        await order.update({
          reviewRequired: true,
          reviewReason: "webhook_processing_failed",
          updatedAt: Date.now(),
        });
    }
    throw error;
  }
}
