import { beforeAll, afterAll, it, expect } from "vitest";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";
import {
  recordEngagement,
  sellerListingStats,
} from "../src/lib/listing-engagement";
import { publicPhone } from "../src/lib/public-phone";
import { listing, testProject } from "./fixtures";
const app = initializeApp({ projectId: testProject }, "engagement-tests"),
  db = getFirestore(app);
let env: RulesTestEnvironment;
beforeAll(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8180")
    throw Error("Isolated emulators required");
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
  await env?.cleanup();
  await deleteApp(app);
});
it("counts daily visitors once, excludes sellers, retains historical views and caps daily writes", async () => {
  const id = "stats-daily",
    owner = "stats-owner",
    now = Date.UTC(2026, 9, 23, 12);
  await db.doc(`listings/${id}`).set(listing(owner, id));
  await recordEngagement(db, id, "view", "uid:viewer", "viewer", now);
  await Promise.all([
    recordEngagement(db, id, "view", "uid:viewer", "viewer", now + 1),
    recordEngagement(db, id, "view", "uid:viewer", "viewer", now + 2),
  ]);
  await recordEngagement(db, id, "view", "uid:" + owner, owner, now);
  expect((await db.doc(`listingStats/${id}`).get()).data()?.view).toBe(1);
  await recordEngagement(db, id, "message", "uid:viewer", "viewer", now);
  await recordEngagement(db, id, "message", "uid:viewer", "viewer", now + 1);
  expect((await db.doc(`listingStats/${id}`).get()).data()?.message).toBe(1);
  await db.doc(`listings/${id}`).update({ status: "sold" });
  await expect(
    recordEngagement(db, id, "message", "uid:viewer", "viewer", now),
  ).rejects.toMatchObject({ status: 409 });
  await recordEngagement(
    db,
    id,
    "view",
    "uid:viewer",
    "viewer",
    now + 86400000,
  );
  expect((await db.doc(`listingStats/${id}`).get()).data()?.view).toBe(2);
  const total = (await db.doc(`listingStats/${id}`).get()).data()!;
  await db.doc(`listingStats/${id}`).update({ dailyEvents: 10000 });
  expect(
    (
      await recordEngagement(
        db,
        id,
        "view",
        "uid:other",
        "other",
        now + 86400000,
      )
    ).recorded,
  ).toBe(false);
  expect((await db.doc(`listingStats/${id}`).get()).data()?.view).toBe(
    total.view,
  );
});
it("counts only real available public phone reveals and protects raw metrics and visitor records", async () => {
  const id = "stats-phone",
    uid = "stats-phone-owner";
  await db.doc(`listings/${id}`).set(listing(uid, id));
  await expect(
    recordEngagement(db, id, "phone", "uid:buyer", "buyer"),
  ).rejects.toMatchObject({ status: 404 });
  await db
    .doc(`profiles/${uid}`)
    .set({
      accountType: "personal",
      contactPhone: "+27 82 123 4567",
      contactPhonePublic: true,
    });
  expect(
    (await recordEngagement(db, id, "phone", "uid:buyer", "buyer")).phone,
  ).toBe("+27821234567");
  expect((await db.doc(`listingStats/${id}`).get()).data()?.phone).toBe(1);
  await assertFails(
    getDoc(doc(env.authenticatedContext(uid).firestore(), "listingStats", id)),
  );
  await assertFails(
    setDoc(doc(env.authenticatedContext(uid).firestore(), "listingStats", id), {
      view: 999,
    }),
  );
  await assertFails(
    setDoc(
      doc(
        env.authenticatedContext("buyer").firestore(),
        "listingStats",
        id,
        "engagementVisitors",
        "fake",
      ),
      { view: 1 },
    ),
  );
  const raw = (
    await db.collection(`listingStats/${id}/engagementVisitors`).get()
  ).docs[0];
  expect(raw.id).not.toContain("buyer");
  expect(raw.data()).not.toHaveProperty("uid");
  await db.doc(`listings/${id}`).update({ status: "hidden" });
  await expect(
    recordEngagement(db, id, "view", "uid:buyer", "buyer"),
  ).rejects.toMatchObject({ status: 404 });
});
it("returns seller-only totals and counts actual current favourites, including unsaves", async () => {
  const id = "stats-favourites",
    uid = "stats-favourite-owner";
  await db.doc(`listings/${id}`).set(listing(uid, id));
  await db
    .doc(`users/stats-buyer-a/favourites/${id}`)
    .set({ listingId: id, createdAt: Date.now() });
  await db
    .doc(`users/stats-buyer-b/favourites/${id}`)
    .set({ listingId: id, createdAt: Date.now() });
  expect((await sellerListingStats(db, id, uid)).favourites).toBe(2);
  await deleteDoc(
    doc(
      env.authenticatedContext("stats-buyer-a").firestore(),
      "users",
      "stats-buyer-a",
      "favourites",
      id,
    ),
  );
  expect((await sellerListingStats(db, id, uid)).favourites).toBe(1);
  await expect(sellerListingStats(db, id, "other")).rejects.toMatchObject({
    status: 403,
  });
});
it("accepts only the optional explicitly public profile phone field, not arbitrary private data", async () => {
  const uid = "stats-profile-phone";
  const profile = {
    displayName: "Phone Seller",
    bio: "",
    city: "",
    country: "ZA",
    sellerType: "private",
    accountType: "personal",
    createdAt: Date.now(),
    contactPhone: "+27 82 123 4567",
    contactPhonePublic: true,
  };
  await assertSucceeds(
    setDoc(
      doc(env.authenticatedContext(uid).firestore(), "profiles", uid),
      profile,
    ),
  );
  await assertFails(
    setDoc(doc(env.authenticatedContext(uid).firestore(), "profiles", uid), {
      ...profile,
      contactPhone: "javascript:evil",
    }),
  );
  await assertFails(
    setDoc(
      doc(env.authenticatedContext("other").firestore(), "profiles", uid),
      profile,
    ),
  );
  expect(
    publicPhone({
      contactPhone: "+27 (82) 123-4567",
      contactPhonePublic: true,
    }),
  ).toBe("+27821234567");
  expect(
    publicPhone({
      accountType: "business",
      business: { phone: "+27831234567" },
      businessContactsPublic: true,
    }),
  ).toBe("+27831234567");
  expect(publicPhone({ contactPhone: "not a phone" })).toBe("");
});
