import { beforeAll, afterAll, it, expect } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteField,
} from "firebase/firestore";
import { ref, uploadBytes, deleteObject, getBytes } from "firebase/storage";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { listing, testProject } from "./fixtures";
import { categoryFields } from "../src/lib/taxonomy";
import {
  emptyBusiness,
  accountTypeOf,
  businessSchema,
  sellerLabel,
} from "../src/lib/seller-account";
import { inspectRunningVideo } from "../src/lib/video-inspection";
import { videoAction } from "../src/lib/video-service";
import { mutateListing as mutateListingService } from "../src/lib/listing-lifecycle";
import { finishListingMedia } from "../src/lib/listing-media";
import { generateTestVideo, seedReadyVideo } from "./video-fixture";
import {
  pruneAbandonedVideos,
  auditLegacyMotorcycleVideos,
} from "../src/lib/video-maintenance";
let env: RulesTestEnvironment, directory: string, bytes: Buffer;
const app = initializeApp(
    { projectId: testProject, storageBucket: `${testProject}.appspot.com` },
    "seller-video-tests",
  ),
  store = getFirestore(app),
  bucket = getStorage(app).bucket();
function mutateListing(...args: Parameters<typeof mutateListingService>) {
  args[5] = bucket;
  return mutateListingService(...args);
}
const actor = (uid: string) => env.authenticatedContext(uid),
  profile = (type = "personal") => ({
    displayName: "Video seller",
    bio: "",
    city: "Johannesburg",
    region: "ZA-GP",
    country: "ZA",
    sellerType: type === "business" ? "dealer" : "private",
    accountType: type,
    createdAt: Date.now(),
    ...(type === "business"
      ? {
          business: {
            ...emptyBusiness,
            name: "Off-road Workshop",
            category: "Workshop",
          },
        }
      : {}),
  });
beforeAll(async () => {
  if (
    process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8180" ||
    process.env.FIREBASE_STORAGE_EMULATOR_HOST !== "127.0.0.1:9298"
  )
    throw Error("Isolated emulators only");
  env = await initializeTestEnvironment({
    projectId: testProject,
    firestore: {
      host: "127.0.0.1",
      port: 8180,
      rules: readFileSync("firestore.rules", "utf8"),
    },
    storage: {
      host: "127.0.0.1",
      port: 9298,
      rules: readFileSync("storage.rules", "utf8"),
    },
  });
  directory = await mkdtemp(path.join(tmpdir(), "throttlehub-test-video-"));
  await generateTestVideo(path.join(directory, "running.mp4"));
  bytes = await readFile(path.join(directory, "running.mp4"));
}, 30000);
afterAll(async () => {
  await env?.cleanup();
  await deleteApp(app);
  if (directory) await rm(directory, { recursive: true, force: true });
});
it.each(["personal", "business"])(
  "creates a %s account profile without granting roles",
  async (type) => {
    const uid = `sv-${type}`,
      db = actor(uid).firestore();
    await assertSucceeds(setDoc(doc(db, "profiles", uid), profile(type)));
    await assertFails(updateDoc(doc(db, "profiles", uid), { admin: true }));
    await assertFails(
      updateDoc(doc(db, "profiles", uid), { verifiedBusiness: true }),
    );
    expect(accountTypeOf((await getDoc(doc(db, "profiles", uid))).data())).toBe(
      type,
    );
  },
);
it("changes account type without changing identity or deleting related data", async () => {
  const db = actor("sv-personal").firestore();
  await store
    .doc("users/sv-personal/favourites/keep")
    .set({ listingId: "keep", createdAt: 1 });
  await assertSucceeds(
    updateDoc(doc(db, "profiles", "sv-personal"), {
      accountType: "business",
      sellerType: "dealer",
      business: { ...emptyBusiness, name: "New business" },
    }),
  );
  await assertSucceeds(
    updateDoc(doc(db, "profiles", "sv-personal"), {
      accountType: "personal",
      sellerType: "private",
      business: deleteField(),
    }),
  );
  expect(
    (
      await getDoc(doc(db, "users", "sv-personal", "favourites", "keep"))
    ).exists(),
  ).toBe(true);
  expect(accountTypeOf({ sellerType: "dealer" })).toBe("business");
  expect(accountTypeOf({})).toBe("personal");
});
it("rejects incomplete business data and forged verification inside business fields", async () => {
  const db = actor("sv-invalid").firestore();
  await assertFails(
    setDoc(doc(db, "profiles", "sv-invalid"), {
      ...profile("business"),
      business: { ...emptyBusiness, name: "" },
    }),
  );
  await assertFails(
    setDoc(doc(db, "profiles", "sv-invalid"), {
      ...profile("business"),
      business: { ...emptyBusiness, name: "Business", verified: true },
    }),
  );
  expect(
    businessSchema.safeParse({
      ...emptyBusiness,
      name: "Business",
      website: "javascript:alert(1)",
    }).success,
  ).toBe(false);
  expect(sellerLabel("business")).toBe("Business Seller");
  expect(sellerLabel("personal")).toBe("Private Seller");
});
it("requires account selection on new profiles while preserving legacy edits without a business-name bypass", async () => {
  const uid = "sv-legacy-profile",
    db = actor(uid).firestore();
  const { accountType: _accountType, ...legacy } = profile("personal");
  void _accountType;
  await assertFails(setDoc(doc(db, "profiles", uid), legacy));
  await store.doc(`profiles/${uid}`).set(legacy);
  await assertSucceeds(
    updateDoc(doc(db, "profiles", uid), { bio: "Still an existing rider" }),
  );
  await assertFails(
    updateDoc(doc(db, "profiles", uid), { sellerType: "dealer" }),
  );
  await assertSucceeds(
    updateDoc(doc(db, "profiles", uid), {
      accountType: "business",
      sellerType: "dealer",
      business: { ...emptyBusiness, name: "Proper business" },
    }),
  );
});
it("permits unfinished motorcycle drafts but rejects publication and forged ready fields", async () => {
  const id = "sv-incomplete",
    uid = "sv-incomplete-owner",
    values = listing(uid, id);
  await expect(
    mutateListing(
      store,
      id,
      { uid },
      { action: "save", status: "draft", values, images: [] },
    ),
  ).resolves.toMatchObject({ status: "draft" });
  await expect(
    mutateListing(
      store,
      id,
      { uid },
      {
        action: "save",
        status: "published",
        values,
        images: ["photo"],
        runningVideo: { status: "ready" },
        videoVerified: true,
      },
    ),
  ).rejects.toThrow("running video");
  await assertFails(
    updateDoc(doc(actor(uid).firestore(), "listings", id), {
      status: "published",
      videoVerified: true,
    }),
  );
  await assertFails(
    setDoc(doc(actor(uid).firestore(), "listings", id, "videos", "forged"), {
      status: "ready",
      uploaderId: uid,
    }),
  );
});
it("does not require a running video for spare parts", async () => {
  const uid = "sv-parts",
    id = "sv-parts",
    values = {
      ...listing(uid, id),
      ...categoryFields("parts/engine/top-end/cylinder-heads"),
    };
  await expect(
    mutateListing(
      store,
      id,
      { uid },
      { action: "save", status: "published", values, images: ["photo"] },
    ),
  ).resolves.toMatchObject({ status: "published" });
});
it("does not let a petrol engine use the silent-electric declaration or a parts category bypass", async () => {
  const uid = "sv-petrol",
    id = "sv-petrol";
  await seedReadyVideo(store, id, uid, bucket);
  await store
    .doc(`listings/${id}/videos/test-ready`)
    .update({ demonstration: "electric", hasAudio: false });
  const values = listing(uid, id);
  values.details.engineType = "four-stroke";
  await expect(
    mutateListing(
      store,
      id,
      { uid },
      {
        action: "save",
        status: "published",
        values,
        images: ["photo"],
        runningVideoId: "test-ready",
      },
    ),
  ).rejects.toThrow("with sound");
  await expect(
    mutateListing(
      store,
      "sv-parts",
      { uid: "sv-parts" },
      {
        action: "save",
        status: "published",
        values: listing("sv-parts", "sv-parts"),
        images: ["photo"],
      },
    ),
  ).rejects.toThrow("running video");
});
it("captures the current account type at first publication and retains it after later account changes", async () => {
  const uid = "sv-snapshot",
    id = "sv-snapshot",
    values = {
      ...listing(uid, id),
      ...categoryFields("parts/engine/top-end/cylinder-heads"),
    };
  await store.doc(`profiles/${uid}`).set(profile("personal"));
  await mutateListing(
    store,
    id,
    { uid },
    { action: "save", status: "draft", values, images: [] },
  );
  await store.doc(`profiles/${uid}`).set(profile("business"));
  await mutateListing(
    store,
    id,
    { uid },
    { action: "save", status: "published", values, images: ["photo"] },
  );
  expect(
    (await store.doc(`listings/${id}`).get()).data()?.sellerAccountType,
  ).toBe("business");
  await store.doc(`profiles/${uid}`).set(profile("personal"));
  await mutateListing(
    store,
    id,
    { uid },
    { action: "save", status: "published", values, images: ["photo"] },
  );
  expect(
    (await store.doc(`listings/${id}`).get()).data()?.sellerAccountType,
  ).toBe("business");
});
it("validates actual MP4 bytes and rejects renamed files, bad durations and missing petrol audio", async () => {
  expect(
    await inspectRunningVideo(path.join(directory, "running.mp4"), "petrol"),
  ).toMatchObject({ hasAudio: true, width: 128, height: 96 });
  const fake = path.join(directory, "fake.mp4");
  await writeFile(fake, "not a video");
  await expect(inspectRunningVideo(fake, "petrol")).rejects.toThrow("MP4");
  const short = path.join(directory, "short.mp4");
  await generateTestVideo(short, 2);
  await expect(inspectRunningVideo(short, "petrol")).rejects.toThrow("15");
  const silent = path.join(directory, "silent.mp4");
  await generateTestVideo(silent, 16, false);
  await expect(inspectRunningVideo(silent, "petrol")).rejects.toThrow("audio");
  expect(await inspectRunningVideo(silent, "electric")).toMatchObject({
    hasAudio: false,
  });
}, 30000);
it("uses owned staging slots and prevents overwrite, cross-user uploads and oversized/wrong-type files", async () => {
  const uid = "sv-staging",
    id = "sv-staging",
    slot = await videoAction(store, bucket, uid, id, {
      action: "begin",
      demonstration: "petrol",
    });
  if (!("path" in slot)) throw Error("No slot");
  const object = ref(
    actor(uid).storage(`gs://${testProject}.appspot.com`),
    slot.path as string,
  );
  await assertFails(
    uploadBytes(
      ref(
        actor("sv-intruder").storage(`gs://${testProject}.appspot.com`),
        slot.path as string,
      ),
      bytes,
      { contentType: "video/mp4" },
    ),
  );
  await assertFails(
    uploadBytes(object, bytes, { contentType: "application/octet-stream" }),
  );
  await assertFails(
    uploadBytes(object, new Uint8Array(100 * 1024 * 1024 + 1), {
      contentType: "video/mp4",
    }),
  );
  await assertSucceeds(
    uploadBytes(object, bytes, { contentType: "video/mp4" }),
  );
  await assertFails(uploadBytes(object, bytes, { contentType: "video/mp4" }));
  await assertFails(
    uploadBytes(
      ref(
        actor(uid).storage(`gs://${testProject}.appspot.com`),
        `listing-videos/${uid}/${id}/forged.mp4`,
      ),
      bytes,
      { contentType: "video/mp4" },
    ),
  );
}, 30000);
it("fully uploads, validates, publishes, preserves sold playback and revokes removal bytes", async () => {
  const uid = "sv-real",
    id = "sv-real";
  await store.doc(`profiles/${uid}`).set(profile("business"));
  const slot = await videoAction(store, bucket, uid, id, {
    action: "begin",
    demonstration: "petrol",
  });
  if (!("path" in slot) || !("id" in slot)) throw Error("No slot");
  await uploadBytes(
    ref(
      actor(uid).storage(`gs://${testProject}.appspot.com`),
      slot.path as string,
    ),
    bytes,
    { contentType: "video/mp4" },
  );
  await expect(
    videoAction(store, bucket, "sv-other", id, {
      action: "validate",
      videoId: slot.id,
    }),
  ).rejects.toMatchObject({ status: 403 });
  const ready = await videoAction(store, bucket, uid, id, {
    action: "validate",
    videoId: slot.id,
  });
  if (!("path" in ready)) throw Error("No video");
  await mutateListing(
    store,
    id,
    { uid },
    {
      action: "save",
      status: "published",
      values: listing(uid, id),
      images: ["photo"],
      runningVideoId: slot.id,
    },
  );
  const saved = (await store.doc(`listings/${id}`).get()).data()!;
  expect(saved.sellerAccountType).toBe("business");
  expect(saved.details.sellerType).toBe("dealer");
  expect(saved.runningVideo.status).toBe("ready");
  await assertSucceeds(
    getBytes(
      ref(
        env.unauthenticatedContext().storage(`gs://${testProject}.appspot.com`),
        ready.path as string,
      ),
    ),
  );
  await assertFails(
    deleteObject(
      ref(
        actor(uid).storage(`gs://${testProject}.appspot.com`),
        ready.path as string,
      ),
    ),
  );
  await expect(
    videoAction(store, bucket, uid, id, {
      action: "discard",
      videoId: slot.id,
    }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    mutateListing(
      store,
      id,
      { uid },
      {
        action: "save",
        status: "published",
        values: listing(uid, id),
        images: ["photo"],
        runningVideoId: "",
      },
    ),
  ).rejects.toThrow("running video");
  await mutateListing(store, id, { uid }, { action: "status", status: "sold" });
  await assertSucceeds(
    getBytes(
      ref(
        env.unauthenticatedContext().storage(`gs://${testProject}.appspot.com`),
        ready.path as string,
      ),
    ),
  );
  await mutateListing(
    store,
    id,
    { uid },
    { action: "status", status: "removed" },
  );
  await finishListingMedia(store, id, bucket);
  expect((await bucket.file(ready.path as string).exists())[0]).toBe(false);
}, 30000);
it("rejects failed uploads and requires ready media when relisting legacy adverts", async () => {
  const uid = "sv-failed",
    id = "sv-failed";
  await store
    .doc(`listings/${id}`)
    .set({ ...listing(uid, id), status: "expired" });
  await expect(
    mutateListing(
      store,
      id,
      { uid },
      { action: "status", status: "published" },
    ),
  ).rejects.toThrow("running video");
  const other = "sv-bad-file",
    slot = await videoAction(store, bucket, uid, other, {
      action: "begin",
      demonstration: "petrol",
    });
  if (!("path" in slot) || !("id" in slot)) throw Error("No slot");
  await uploadBytes(
    ref(
      actor(uid).storage(`gs://${testProject}.appspot.com`),
      slot.path as string,
    ),
    new Uint8Array([1, 2, 3]),
    { contentType: "video/mp4" },
  );
  await expect(
    videoAction(store, bucket, uid, other, {
      action: "validate",
      videoId: slot.id,
    }),
  ).rejects.toThrow("MP4");
  expect(
    (await store.doc(`listings/${other}/videos/${slot.id}`).get()).data()
      ?.status,
  ).toBe("failed");
  expect((await store.doc(`listings/${other}`).get()).exists).toBe(false);
});
it("limits upload slots to six per account per hour", async () => {
  for (let i = 0; i < 6; i++)
    await videoAction(store, bucket, "sv-quota", "sv-quota", {
      action: "begin",
      demonstration: "electric",
    });
  await expect(
    videoAction(store, bucket, "sv-quota", "sv-quota", {
      action: "begin",
      demonstration: "electric",
    }),
  ).rejects.toMatchObject({ status: 429 });
});
it("cleans abandoned objects only after a dry run and retains referenced historical media", async () => {
  const uid = "sv-maintenance",
    id = "sv-maintenance",
    now = Date.now(),
    createdAt = now - 2 * 86400000;
  const stale = store.doc(`listings/${id}/videos/stale`),
    kept = store.doc(`listings/${id}/videos/kept`);
  await store
    .doc(`listings/${id}`)
    .set({ ...listing(uid, id), status: "sold", runningVideoId: "kept" });
  for (const record of [stale, kept]) {
    await record.set({
      id: record.id,
      uploaderId: uid,
      listingId: id,
      status: "ready",
      createdAt,
    });
    await bucket
      .file(`listing-videos/${uid}/${id}/${record.id}.mp4`)
      .save(bytes, {
        resumable: false,
        metadata: { contentType: "video/mp4" },
      });
  }
  expect(
    (await pruneAbandonedVideos(store, bucket, false, now)).eligible,
  ).toBeGreaterThan(0);
  expect((await stale.get()).exists).toBe(true);
  await pruneAbandonedVideos(store, bucket, true, now);
  expect((await stale.get()).exists).toBe(false);
  expect((await kept.get()).exists).toBe(true);
  expect(
    (await bucket.file(`listing-videos/${uid}/${id}/kept.mp4`).exists())[0],
  ).toBe(true);
});
it("reports legacy motorcycles without hiding them and permits adding media before relisting", async () => {
  const uid = "sv-legacy",
    id = "sv-legacy";
  await store.doc(`listings/${id}`).set(listing(uid, id));
  expect(
    (await auditLegacyMotorcycleVideos(store)).missingVideoListingIds,
  ).toContain(id);
  expect((await store.doc(`listings/${id}`).get()).data()?.status).toBe(
    "published",
  );
  await mutateListing(
    store,
    id,
    { uid },
    { action: "status", status: "expired" },
  );
  const slot = await videoAction(store, bucket, uid, id, {
    action: "begin",
    demonstration: "petrol",
  });
  if (!("path" in slot) || !("id" in slot)) throw Error("No upload slot");
  await uploadBytes(
    ref(
      actor(uid).storage(`gs://${testProject}.appspot.com`),
      slot.path as string,
    ),
    bytes,
    { contentType: "video/mp4" },
  );
  await videoAction(store, bucket, uid, id, {
    action: "validate",
    videoId: slot.id,
  });
  await expect(
    mutateListing(
      store,
      id,
      { uid },
      { action: "status", status: "published", runningVideoId: slot.id },
    ),
  ).resolves.toMatchObject({ status: "published" });
}, 30000);
it("rejects missing, replaced and metadata-changed accepted videos at publication and relisting", async () => {
  const uid = "sv-object-check",
    id = "sv-object-check";
  const video = await seedReadyVideo(store, id, uid, bucket);
  const save = {
    action: "save",
    status: "published",
    values: listing(uid, id),
    images: ["photo"],
    runningVideoId: video.id,
  };
  await expect(
    mutateListingService(store, id, { uid }, save),
  ).rejects.toMatchObject({ status: 503 });
  await bucket.file(video.path).delete();
  await expect(mutateListing(store, id, { uid }, save)).rejects.toMatchObject({
    status: 409,
  });
  await bucket
    .file(video.path)
    .save(Buffer.alloc(video.size), { metadata: { contentType: "video/mp4" } });
  await expect(mutateListing(store, id, { uid }, save)).rejects.toMatchObject({
    status: 409,
  });
  const current = await seedReadyVideo(store, id, uid, bucket);
  await bucket
    .file(current.path)
    .setMetadata({ contentType: "application/octet-stream" });
  await expect(mutateListing(store, id, { uid }, save)).rejects.toMatchObject({
    status: 409,
  });
  await seedReadyVideo(store, id, uid, bucket);
  await mutateListing(store, id, { uid }, save);
  await mutateListing(
    store,
    id,
    { uid },
    { action: "status", status: "expired" },
  );
  await expect(
    getBytes(
      ref(
        env.unauthenticatedContext().storage(`gs://${testProject}.appspot.com`),
        video.path,
      ),
    ),
  ).resolves.toBeDefined();
  await bucket.file(video.path).delete();
  await expect(
    mutateListing(
      store,
      id,
      { uid },
      { action: "status", status: "published" },
    ),
  ).rejects.toMatchObject({ status: 409 });
  expect((await store.doc(`listings/${id}`).get()).data()?.status).toBe(
    "expired",
  );
});
it("limits video slots across arbitrary absent listing IDs to twelve per rolling day", async () => {
  const uid = "sv-day-quota";
  await store
    .doc(`postingLimits/${uid}/videoQuota/current`)
    .set({
      startedAt: Date.now() - 7200000,
      count: 6,
      dayStartedAt: Date.now(),
      dayCount: 11,
    });
  await videoAction(store, bucket, uid, "sv-day-new", {
    action: "begin",
    demonstration: "electric",
  });
  await expect(
    videoAction(store, bucket, uid, "sv-day-another", {
      action: "begin",
      demonstration: "electric",
    }),
  ).rejects.toMatchObject({ status: 429 });
  expect((await store.doc("listings/sv-day-another").get()).exists).toBe(false);
});
it("denies staging into an advert restricted after its slot was issued", async () => {
  const uid = "sv-slot-parent",
    id = "sv-slot-parent";
  const slot = await videoAction(store, bucket, uid, id, {
    action: "begin",
    demonstration: "electric",
  });
  if (!("path" in slot)) throw Error("No slot");
  await store
    .doc(`listings/${id}`)
    .set({ ...listing(uid, id), status: "hidden" });
  await assertFails(
    uploadBytes(
      ref(
        actor(uid).storage(`gs://${testProject}.appspot.com`),
        slot.path as string,
      ),
      bytes,
      { contentType: "video/mp4" },
    ),
  );
});
