import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import {
  initializePromotion,
  verifyPromotion,
  entitlementRef,
  orderRef,
  cancelPromotion,
  promotionId,
  type PaymentContext,
} from "../payments-functions/src/core/promotions";
import {
  emailHash,
  type PaymentProvider,
  type VerifiedPayment,
} from "../payments-functions/src/core/paystack";
import { collectionName } from "../payments-functions/src/core/catalogue";
import {
  enqueueWebhook,
  processWebhook,
} from "../payments-functions/src/core/webhooks";
import { reconcilePayments } from "../payments-functions/src/core/reconcile";
import {
  featuredListings,
  visibilityEnvironment,
} from "../src/lib/promotion-readers";
import { queryMarketplace } from "../src/lib/marketplace-search";
import { defaultFilters } from "../src/lib/search-contract";
import { mutateListing } from "../src/lib/listing-lifecycle";
import { categoryFields } from "../src/lib/taxonomy";
import { listing, testProject } from "./fixtures";
// Contended emulator transactions may legitimately retry for more than five seconds.
vi.setConfig({ testTimeout: 20000 });
let transactionSequence = 100000;
class FakePaystack implements PaymentProvider {
  payments = new Map<string, VerifiedPayment>();
  initializations = 0;
  failInitialize = false;
  async initialize(input: {
    reference: string;
    email: string;
    amount: number;
    callbackUrl: string;
  }) {
    this.initializations++;
    this.payments.set(input.reference, {
      reference: input.reference,
      id: String(++transactionSequence),
      domain: "test",
      status: "pending",
      amount: input.amount,
      currency: "ZAR",
      payerHash: emailHash(input.email),
      paidAt: null,
    });
    if (this.failInitialize) throw Error("Provider timeout");
    return { url: "https://checkout.paystack.com/emulator_checkout" };
  }
  async verify(reference: string) {
    return { ...this.payments.get(reference)! };
  }
  async transactionReference(id: string) {
    return (
      [...this.payments.values()].find((p) => p.id === id)?.reference || ""
    );
  }
  success(reference: string) {
    this.payments.set(reference, {
      ...this.payments.get(reference)!,
      status: "success",
      paidAt: new Date().toISOString(),
    });
  }
}
let app: ReturnType<typeof initializeApp>,
  db: ReturnType<typeof getFirestore>,
  env: RulesTestEnvironment;
const oldPreview = process.env.THROTTLEHUB_PROMOTION_PREVIEW_TEST;
beforeAll(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8180")
    throw Error("Isolated emulator required");
  app = initializeApp({ projectId: testProject }, "payment-integration");
  db = getFirestore(app);
  env = await initializeTestEnvironment({
    projectId: testProject,
    firestore: {
      host: "127.0.0.1",
      port: 8180,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});
afterAll(async () => {
  if (oldPreview === undefined)
    delete process.env.THROTTLEHUB_PROMOTION_PREVIEW_TEST;
  else process.env.THROTTLEHUB_PROMOTION_PREVIEW_TEST = oldPreview;
  await env?.cleanup();
  await deleteApp(app);
});
async function setup() {
  const id = `payment-${randomUUID()}`,
    uid = `payer-${randomUUID()}`,
    provider = new FakePaystack(),
    context: PaymentContext = { db, environment: "test", provider };
  await db.doc(`listings/${id}`).set({
    ...listing(uid, id),
    ...categoryFields("parts"),
    category: "Parts & Spares",
  });
  const initialize = (sku = "bump", now = Date.now()) =>
    initializePromotion(
      context,
      uid,
      "seller@example.test",
      id,
      sku,
      "http://localhost:3000/account/promotions",
      now,
    );
  return { id, uid, provider, context, initialize };
}
it("initializes one server-priced order, reuses checkout and rejects foreign/sold/restricted sellers", async () => {
  const x = await setup();
  const [a, b] = await Promise.allSettled([x.initialize(), x.initialize()]);
  const successful = [a, b].filter((r) => r.status === "fulfilled");
  expect(successful.length).toBeGreaterThan(0);
  expect(x.provider.initializations).toBe(1);
  const order = successful[0] as PromiseFulfilledResult<
    Awaited<ReturnType<typeof x.initialize>>
  >;
  expect(
    (await orderRef(x.context, order.value.reference).get()).data()?.amount,
  ).toBe(1900);
  expect((await x.initialize()).reference).toBe(order.value.reference);
  await expect(
    initializePromotion(
      x.context,
      "foreign",
      "foreign@example.test",
      x.id,
      "bump",
      "http://localhost:3000",
    ),
  ).rejects.toMatchObject({ status: 403 });
  await db.doc(`listings/${x.id}`).update({ status: "sold" });
  await expect(x.initialize()).rejects.toMatchObject({ status: 409 });
  const y = await setup();
  await db.doc(`restrictions/${y.uid}`).set({ suspended: true });
  await expect(y.initialize()).rejects.toMatchObject({ status: 403 });
});
it("simultaneous signed webhook and callback activate a bump exactly once, preserve dates and enforce cooldown", async () => {
  const x = await setup(),
    before = (await db.doc(`listings/${x.id}`).get()).data()!,
    order = await x.initialize();
  x.provider.success(order.reference);
  const raw = Buffer.from(
      JSON.stringify({
        event: "charge.success",
        data: {
          reference: order.reference,
          id: x.provider.payments.get(order.reference)!.id,
        },
      }),
    ),
    secret = "sk_test_emulator_secret_only",
    sig = createHmac("sha512", secret).update(raw).digest("hex");
  const receipt = await enqueueWebhook(db, "test", raw, sig, secret);
  await Promise.all([
    verifyPromotion(x.context, order.reference, x.uid),
    processWebhook(x.context, receipt.eventId!),
  ]);
  const promo = (await entitlementRef(db, "test", x.id).get()).data()!,
    paid = (await orderRef(x.context, order.reference).get()).data()!;
  expect(promo.bumpActive).toBe(true);
  expect(paid.status).toBe("fulfilled");
  expect(paid.revenueCents).toBe(0);
  await enqueueWebhook(db, "test", raw, sig, secret);
  await processWebhook(x.context, receipt.eventId!);
  await verifyPromotion(x.context, order.reference, x.uid);
  expect((await entitlementRef(db, "test", x.id).get()).data()?.bumpedAt).toBe(
    promo.bumpedAt,
  );
  expect((await db.doc(`listings/${x.id}`).get()).data()?.createdAt).toBe(
    before.createdAt,
  );
  expect(
    (
      await db
        .collection("promotionPurchasesTest")
        .where("reference", "==", order.reference)
        .get()
    ).size,
  ).toBe(1);
  await expect(x.initialize()).rejects.toMatchObject({ status: 409 });
  await expect(
    verifyPromotion(x.context, order.reference, "foreign"),
  ).rejects.toMatchObject({ status: 403 });
});
it.each([
  { amount: 1 },
  { currency: "NGN" },
  { domain: "live" },
  { reference: "wrong" },
  { payerHash: "wrong" },
])("does not fulfil a mismatched verification %j", async (mismatch) => {
  const x = await setup(),
    order = await x.initialize();
  x.provider.success(order.reference);
  Object.assign(x.provider.payments.get(order.reference)!, mismatch);
  expect(
    (await verifyPromotion(x.context, order.reference, x.uid)).status,
  ).toBe("review_required");
  expect((await entitlementRef(db, "test", x.id).get()).exists).toBe(false);
});
it("records failed/abandoned/delayed payments, undeliverable paid orders and uncertain initialization", async () => {
  const x = await setup(),
    order = await x.initialize();
  x.provider.payments.get(order.reference)!.status = "failed";
  expect(
    (await verifyPromotion(x.context, order.reference, x.uid)).status,
  ).toBe("failed");
  await cancelPromotion(x.context, x.uid, order.reference);
  x.provider.success(order.reference);
  await db.doc(`listings/${x.id}`).update({ status: "expired" });
  expect(
    (await verifyPromotion(x.context, order.reference, x.uid)).status,
  ).toBe("paid_needs_review");
  expect(
    (await orderRef(x.context, order.reference).get()).data()?.reviewRequired,
  ).toBe(true);
  const y = await setup(),
    late = await y.initialize();
  await verifyPromotion(
    y.context,
    late.reference,
    undefined,
    Date.now() + 1300000,
  );
  expect((await orderRef(y.context, late.reference).get()).data()?.status).toBe(
    "abandoned",
  );
  y.provider.success(late.reference);
  expect((await verifyPromotion(y.context, late.reference, y.uid)).status).toBe(
    "fulfilled",
  );
  const z = await setup();
  z.provider.failInitialize = true;
  await expect(z.initialize()).rejects.toThrow();
  const pending = await db
    .collection("paymentOrdersTest")
    .where("uid", "==", z.uid)
    .get();
  expect(pending.docs[0].data().status).toBe("initialization_unknown");
});
it("featured visibility expires by server time, stays separate from live, and sold status revokes placement without deleting orders", async () => {
  const x = await setup(),
    order = await x.initialize("featured7"),
    now = Date.now();
  x.provider.success(order.reference);
  await verifyPromotion(x.context, order.reference, x.uid, now);
  delete process.env.THROTTLEHUB_PROMOTION_PREVIEW_TEST;
  expect(visibilityEnvironment()).toBe("live");
  expect(
    (await featuredListings(db, 100, now)).some((l) => l.id === x.id),
  ).toBe(false);
  process.env.THROTTLEHUB_PROMOTION_PREVIEW_TEST = "true";
  expect(
    (await featuredListings(db, 100, now)).find((l) => l.id === x.id)?.promotion
      ?.test,
  ).toBe(true);
  expect(
    (await featuredListings(db, 100, now + 7 * 86400000 + 1)).some(
      (l) => l.id === x.id,
    ),
  ).toBe(false);
  await mutateListing(
    db,
    x.id,
    { uid: x.uid },
    { action: "status", status: "sold" },
    now + 100,
  );
  expect(
    (await entitlementRef(db, "test", x.id).get()).data()?.featuredActive,
  ).toBe(false);
  expect((await orderRef(x.context, order.reference).get()).exists).toBe(true);
  expect(
    (await featuredListings(db, 100, now + 200)).some((l) => l.id === x.id),
  ).toBe(false);
});
it("refund/dispute events revoke benefits, are replay-safe, and late success cannot restore them", async () => {
  const x = await setup(),
    order = await x.initialize("featured30");
  x.provider.success(order.reference);
  await verifyPromotion(x.context, order.reference, x.uid);
  const secret = "sk_test_emulator_secret_only";
  for (const event of [
    "charge.dispute.create",
    "charge.dispute.resolve",
    "refund.processed",
  ]) {
    const raw = Buffer.from(
        JSON.stringify({
          event,
          data: {
            transaction: {
              id: x.provider.payments.get(order.reference)!.id,
              reference: order.reference,
            },
            amount: 12900,
          },
        }),
      ),
      signature = createHmac("sha512", secret).update(raw).digest("hex"),
      receipt = await enqueueWebhook(db, "test", raw, signature, secret);
    await processWebhook(x.context, receipt.eventId!);
    await processWebhook(x.context, receipt.eventId!);
  }
  expect(
    (await orderRef(x.context, order.reference).get()).data()?.status,
  ).toBe("refunded");
  await verifyPromotion(x.context, order.reference, x.uid);
  expect(
    (await entitlementRef(db, "test", x.id).get()).data()?.featuredActive,
  ).toBe(false);
});
it("paid bumps merge into newest ranking and later organic listings can move above them", async () => {
  process.env.THROTTLEHUB_PROMOTION_PREVIEW_TEST = "true";
  const x = await setup(),
    now = Date.now();
  await db.doc(`listings/${x.id}`).update({ createdAt: now - 10000000 });
  const order = await x.initialize();
  x.provider.success(order.reference);
  await verifyPromotion(x.context, order.reference, x.uid, now);
  const fresh = `fresh-${randomUUID()}`;
  await db
    .doc(`listings/${fresh}`)
    .set({ ...listing("fresh-owner", fresh), createdAt: now + 10000 });
  const results = await queryMarketplace(db, {
    ...defaultFilters,
    term: "Permission",
  });
  expect(results.items.findIndex((l) => l.id === fresh)).toBeLessThan(
    results.items.findIndex((l) => l.id === x.id),
  );
  const all = [...results.items];
  let page = results;
  for (let i = 0; i < 6 && page.more && page.cursor; i++) {
    page = await queryMarketplace(
      db,
      { ...defaultFilters, term: "Permission" },
      page.cursor,
    );
    all.push(...page.items);
  }
  expect(all.filter((l) => l.id === x.id)).toHaveLength(1);
});
it("keeps accounting/entitlements/limits/receipts private and denies client promotion flags", async () => {
  const x = await setup(),
    order = await x.initialize();
  x.provider.success(order.reference);
  await verifyPromotion(x.context, order.reference, x.uid);
  const seller = env.authenticatedContext(x.uid).firestore(),
    anonymous = env.unauthenticatedContext().firestore();
  for (const [collection, id] of [
    ["paymentOrdersTest", order.reference],
    ["listingPromotionsTest", promotionId(x.id)],
    ["promotionPurchasesTest", order.reference],
    ["paymentLimitsTest", x.uid],
  ]) {
    await assertFails(getDoc(doc(seller, collection, id)));
    await assertFails(getDoc(doc(anonymous, collection, id)));
    await assertFails(
      setDoc(doc(seller, collection, id), { featuredActive: true }),
    );
  }
  await assertFails(
    updateDoc(doc(seller, "listings", x.id), {
      featured: true,
      bumpedAt: Date.now(),
    }),
  );
});
it("distributed initialization quotas and scheduled recovery retain recoverable successful payments", async () => {
  const x = await setup();
  await db
    .collection(collectionName("paymentLimits", "test"))
    .doc(x.uid)
    .set({ windowAt: Date.now(), count: 6 });
  await expect(x.initialize()).rejects.toMatchObject({ status: 429 });
  const y = await setup(),
    order = await y.initialize();
  y.provider.success(order.reference);
  await orderRef(y.context, order.reference).update({ nextCheckAt: 0 });
  const result = await reconcilePayments(y.context);
  expect(result.orders).toBeGreaterThan(0);
  expect(
    (await orderRef(y.context, order.reference).get()).data()?.status,
  ).toBe("fulfilled");
});
it("a signed partial refund suspends placement immediately and stays in manual review during provider failure", async () => {
  const x = await setup(),
    order = await x.initialize("featured7");
  x.provider.success(order.reference);
  await verifyPromotion(x.context, order.reference, x.uid);
  const secret = "sk_test_emulator_secret_only",
    raw = Buffer.from(
      JSON.stringify({
        event: "refund.processed",
        data: {
          transaction: {
            id: x.provider.payments.get(order.reference)!.id,
            reference: order.reference,
          },
          amount: 100,
        },
      }),
    ),
    signature = createHmac("sha512", secret).update(raw).digest("hex");
  const receipt = await enqueueWebhook(db, "test", raw, signature, secret);
  expect(
    (await entitlementRef(db, "test", x.id).get()).data()?.featuredActive,
  ).toBe(false);
  const original = x.provider.verify.bind(x.provider);
  x.provider.verify = async () => {
    throw Error("temporary failure");
  };
  await expect(processWebhook(x.context, receipt.eventId!)).rejects.toThrow();
  expect(
    (await orderRef(x.context, order.reference).get()).data()?.reviewRequired,
  ).toBe(true);
  x.provider.verify = original;
  await processWebhook(x.context, receipt.eventId!);
  expect(
    (await orderRef(x.context, order.reference).get()).data()?.status,
  ).toBe("refund_processed_review");
  expect(
    (await orderRef(x.context, order.reference).get()).data()?.reviewRequired,
  ).toBe(true);
});
