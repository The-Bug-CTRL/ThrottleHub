import { beforeAll, afterAll, it, expect } from "vitest";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { ensureProfile, editProfile } from "../src/lib/profile-service";
import { emptyBusiness } from "../src/lib/seller-account";
import { importedFeed } from "../src/lib/imported-content-server";
import { testProject } from "./fixtures";
let app: ReturnType<typeof initializeApp>, db: ReturnType<typeof getFirestore>;

beforeAll(() => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8180")
    throw Error("Isolated emulator required");
  app = initializeApp({ projectId: testProject }, "content-profile-tests");
  db = getFirestore(app);
});
afterAll(async () => {
  await deleteApp(app);
});
it("atomically creates one canonical Personal/Business profile; repeated and concurrent repair never resets existing data", async () => {
  expect((await ensureProfile(db, "profile-personal", {})).needsSetup).toBe(
    true,
  );
  expect((await db.doc("profiles/profile-personal").get()).exists).toBe(false);
  const calls = await Promise.all(
    Array.from({ length: 5 }, () =>
      ensureProfile(db, "profile-personal", {
        accountType: "personal",
        displayName: "Rider One",
      }),
    ),
  );
  expect(calls.filter((x) => x.created)).toHaveLength(1);
  const personal = (await db.doc("profiles/profile-personal").get()).data()!;
  expect(personal.createdAt).toBe(personal.updatedAt);
  expect(personal.accountType).toBe("personal");
  expect(personal.email).toBeUndefined();
  const business = { ...emptyBusiness, name: "Real Store" };
  await ensureProfile(db, "profile-business", {
    accountType: "business",
    business,
    displayName: "Store Owner",
  });
  const before = (await db.doc("profiles/profile-business").get()).data();
  await ensureProfile(db, "profile-business", {
    accountType: "personal",
    displayName: "Should not overwrite",
  });
  expect((await db.doc("profiles/profile-business").get()).data()).toEqual(
    before,
  );
  await ensureProfile(db, "profile-google", {
    accountType: "personal",
    photoURL: "https://example.com/avatar.jpg",
    displayName: "Google Rider",
  });
  expect((await db.doc("profiles/profile-google").get()).data()?.photoURL).toBe(
    "https://example.com/avatar.jpg",
  );
  expect((await db.doc("users/profile-personal").get()).exists).toBe(false);
  await editProfile(db, "profile-personal", {
    accountType: "personal",
    displayName: "Updated Rider",
    photoURL: "",
    bio: "A rider",
    city: "",
    region: "",
    country: "ZA",
    contactPhone: "",
  });
  const after = (await db.doc("profiles/profile-personal").get()).data()!;
  expect(after.createdAt).toBe(personal.createdAt);
  expect(after.updatedAt).toBeGreaterThanOrEqual(personal.updatedAt);
}, 20000); // Five contended SDK transactions may retry past the default 5 seconds.
it("rejects spoofed UIDs, arbitrary roles and private Auth fields without account approvals", async () => {
  for (const extra of [
    { uid: "other" },
    { admin: true },
    { verified: true },
    { role: "admin" },
    { email: "private@example.com" },
    { createdAt: 1 },
  ])
    await expect(
      ensureProfile(db, "profile-approved", {
        accountType: "personal",
        ...extra,
      }),
    ).rejects.toThrow();
  await expect(
    ensureProfile(db, "profile-approved", { accountType: "business" }),
  ).rejects.toThrow();
  expect((await db.doc("profiles/profile-approved").get()).exists).toBe(false);
});
it("reads real SDK news records in date order, filters hidden/draft content, searches and paginates", async () => {
  for (let i = 0; i < 16; i++)
    await db.doc(`contentNews/integration-news-${i}`).set({
      title: `Source story ${i}`,
      summary: "Two stroke racing",
      publisher: "Publisher",
      url: "https://example.com/story",
      status: i === 15 ? "draft" : "published",
      manuallyHidden: i === 14,
      publishedAt: 10000 + i,
      category: i % 2 ? "Racing" : "Tech",
      contentHash: "not public",
    });
  const first = await importedFeed(db, "news");
  expect(first.items).toHaveLength(12);
  expect(first.items[0].id).toBe("integration-news-13");
  expect(first.cursor).toBeTruthy();
  expect(JSON.stringify(first)).not.toContain("not public");
  const next = await importedFeed(db, "news", { cursor: first.cursor! });
  expect(next.items).toHaveLength(2);
  expect(next.cursor).toBeNull();
  const filtered = await importedFeed(db, "news", {
    category: "Tech",
    search: "two stroke",
  });
  expect(filtered.items).toHaveLength(7);
});
it("calendar queries preserve ongoing and historical records and province/level/discipline/country filters", async () => {
  const day = new Date().toISOString().slice(0, 10);
  const base = {
    title: "Official race",
    publicationStatus: "published",
    startDate: "2099-01-01",
    endDate: "2099-01-02",
    country: "ZA",
    province: "ZA-GP",
    discipline: "MX",
    level: "regional",
    city: null,
    championship: null,
  };
  await db.doc("contentRaces/integration-race-future").set(base);
  await db
    .doc("contentRaces/integration-race-past")
    .set({ ...base, startDate: "2000-01-01", endDate: "2000-01-02" });
  await db
    .doc("contentRaces/integration-race-hidden")
    .set({ ...base, manuallyHidden: true });
  await db
    .doc("contentRaces/integration-race-draft")
    .set({ ...base, publicationStatus: "draft" });
  await db
    .doc("contentRaces/integration-race-international")
    .set({ ...base, country: "US" });
  await db
    .doc("contentRaces/integration-race-ongoing")
    .set({ ...base, startDate: "2000-01-01", endDate: day });
  const filtered = await importedFeed(db, "races", {
    country: "za",
    province: "Gauteng",
    discipline: "Motocross",
    level: "Regional",
  });
  expect(filtered.items.map((x) => x.id)).toEqual([
    "integration-race-ongoing",
    "integration-race-future",
  ]);
  expect(
    (await importedFeed(db, "races", { past: true })).items.map((x) => x.id),
  ).toEqual(["integration-race-past"]);
  expect(
    (await importedFeed(db, "races", { country: "international" })).items.map(
      (x) => x.id,
    ),
  ).toEqual(["integration-race-international"]);
});
