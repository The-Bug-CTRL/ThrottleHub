import { beforeAll, afterAll, it, expect } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { ref, uploadBytes, getBytes } from "firebase/storage";
import {
  uploadListingPhoto,
  sanitizePhoto,
  MAX_PHOTO_BYTES,
} from "../src/lib/photo-service";
import { pruneAbandonedPhotos } from "../src/lib/photo-maintenance";
import { finishListingMedia } from "../src/lib/listing-media";
import { mutateListing } from "../src/lib/listing-lifecycle";
import { listing, testProject } from "./fixtures";
import { categoryFields } from "../src/lib/taxonomy";
let env: RulesTestEnvironment, bytes: Buffer;
const app = initializeApp(
    { projectId: testProject, storageBucket: `${testProject}.appspot.com` },
    "photo-tests",
  ),
  db = getFirestore(app),
  bucket = getStorage(app).bucket();
beforeAll(async () => {
  if (
    process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8180" ||
    process.env.FIREBASE_STORAGE_EMULATOR_HOST !== "127.0.0.1:9298"
  )
    throw Error("Isolated emulators required");
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
  bytes = await sharp({
    create: { width: 100, height: 80, channels: 3, background: "green" },
  })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
});
afterAll(async () => {
  await env?.cleanup();
  await deleteApp(app);
});
it("decodes photos, rotates and strips metadata; rejects corrupt, empty, SVG and oversized input", async () => {
  const clean = await sanitizePhoto(bytes),
    m = await sharp(clean).metadata();
  expect(m.format).toBe("jpeg");
  expect(m.exif).toBeUndefined();
  expect(m.orientation).toBeUndefined();
  for (const bad of [
    Buffer.from("bad"),
    Buffer.alloc(0),
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
    ),
    Buffer.alloc(MAX_PHOTO_BYTES + 1),
  ])
    await expect(sanitizePhoto(bad)).rejects.toThrow();
});
it("denies direct SDK staging but accepts quota-controlled trusted decoding and protects publication", async () => {
  const uid = "photo-test-owner",
    id = "photo-test-listing";
  await assertFails(
    uploadBytes(
      ref(
        env
          .authenticatedContext(uid)
          .storage(`gs://${testProject}.appspot.com`),
        `listing-images/${uid}/${id}/bypass.jpg`,
      ),
      bytes,
      { contentType: "image/jpeg" },
    ),
  );
  const photo = await uploadListingPhoto(db, bucket, uid, id, bytes);
  const values = {
    ...listing(uid, id),
    ...categoryFields("parts/engine/top-end/cylinder-heads"),
  };
  await mutateListing(
    db,
    id,
    { uid },
    { action: "save", status: "published", values, images: [photo.url] },
    Date.now(),
    bucket,
  );
  const r = await db.doc(`listings/${id}/photos/${photo.id}`).get();
  expect(r.data()?.status).toBe("ready");
  await expect(
    getBytes(
      ref(
        env.unauthenticatedContext().storage(`gs://${testProject}.appspot.com`),
        r.data()!.path,
      ),
    ),
  ).resolves.toBeDefined();
  await mutateListing(db, id, { uid }, { action: "status", status: "expired" });
  await db
    .doc(`listings/${id}/photos/${photo.id}`)
    .update({ createdAt: Date.now() - 3 * 86400000 });
  await pruneAbandonedPhotos(db, bucket, true);
  expect((await bucket.file(r.data()!.path).exists())[0]).toBe(true);
  await bucket.file(r.data()!.path).delete();
  await expect(
    mutateListing(
      db,
      id,
      { uid },
      { action: "status", status: "published" },
      Date.now(),
      bucket,
    ),
  ).rejects.toMatchObject({ status: 409 });
  expect((await db.doc(`listings/${id}`).get()).data()?.status).toBe("expired");
  await mutateListing(db, id, { uid }, { action: "status", status: "removed" });
  await finishListingMedia(db, id, bucket);
  expect(
    (await db.collection("listings").doc(id).collection("photos").get()).empty,
  ).toBe(true);
});
it("denies foreign, suspended and quota-exhausted uploads across nonexistent IDs", async () => {
  await db
    .doc("listings/photo-test-foreign")
    .set({ ...listing("other", "photo-test-foreign"), status: "draft" });
  await expect(
    uploadListingPhoto(
      db,
      bucket,
      "photo-test-owner",
      "photo-test-foreign",
      bytes,
    ),
  ).rejects.toMatchObject({ status: 403 });
  await db.doc("restrictions/photo-test-suspended").set({ suspended: true });
  await expect(
    uploadListingPhoto(db, bucket, "photo-test-suspended", "absent", bytes),
  ).rejects.toMatchObject({ status: 403 });
  await db
    .doc("postingLimits/photo-test-quota/photoQuota/current")
    .set({ startedAt: Date.now(), count: 24 });
  await expect(
    uploadListingPhoto(db, bucket, "photo-test-quota", "new-id", bytes),
  ).rejects.toMatchObject({ status: 429 });
});
it("photo cleanup is dry-run by default, deletes claimed orphans and prevents their publication", async () => {
  const uid = "photo-test-orphan",
    id = "photo-test-orphan";
  const p = await uploadListingPhoto(db, bucket, uid, id, bytes),
    r = db.doc(`listings/${id}/photos/${p.id}`);
  await r.update({ createdAt: Date.now() - 3 * 86400000 });
  const object = (await r.get()).data()!.path;
  expect((await pruneAbandonedPhotos(db, bucket)).dryRun).toBe(true);
  expect((await bucket.file(object).exists())[0]).toBe(true);
  await pruneAbandonedPhotos(db, bucket, true);
  expect((await bucket.file(object).exists())[0]).toBe(false);
  await expect(
    mutateListing(
      db,
      id,
      { uid },
      {
        action: "save",
        status: "published",
        values: {
          ...listing(uid, id),
          ...categoryFields("parts/engine/top-end/cylinder-heads"),
        },
        images: [p.url],
      },
      Date.now(),
      bucket,
    ),
  ).rejects.toMatchObject({ status: 409 });
});
it("keeps legacy unattested UUID photos readable through sale and permits trusted removal", async () => {
  const uid = "photo-legacy-owner",
    id = "photo-legacy-ad",
    photoId = crypto.randomUUID(),
    object = `listing-images/${uid}/${id}/${photoId}.jpg`;
  await bucket
    .file(object)
    .save(bytes, { metadata: { contentType: "image/jpeg" } });
  const url = `http://127.0.0.1:9298/v0/b/${bucket.name}/o/${encodeURIComponent(object)}?alt=media`;
  await db
    .doc(`listings/${id}`)
    .set({ ...listing(uid, id), status: "published", images: [url] });
  await mutateListing(db, id, { uid }, { action: "status", status: "sold" });
  await expect(
    getBytes(
      ref(
        env.unauthenticatedContext().storage(`gs://${testProject}.appspot.com`),
        object,
      ),
    ),
  ).resolves.toBeDefined();
  await mutateListing(db, id, { uid }, { action: "status", status: "removed" });
  await finishListingMedia(db, id, bucket);
  expect((await bucket.file(object).exists())[0]).toBe(false);
});
