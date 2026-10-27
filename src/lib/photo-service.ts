import sharp from "sharp";
import type { Firestore } from "firebase-admin/firestore";
import type { Bucket } from "@google-cloud/storage";
import { randomUUID } from "node:crypto";
import { ListingError } from "./listing-lifecycle";
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export async function sanitizePhoto(bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES)
    throw new ListingError("Use a photo under 5 MB.", 413);
  const jpeg = bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  const png = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp =
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP";
  if (!jpeg && !png && !webp)
    throw new ListingError("Use a JPEG, PNG or WebP photo.", 422);
  try {
    const image = sharp(bytes, {
      limitInputPixels: 24_000_000,
      failOn: "warning",
    });
    const metadata = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(metadata.format || "") ||
      (metadata.pages || 1) !== 1
    )
      throw Error("Unsupported image");
    return await image
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 84 })
      .timeout({ seconds: 15 })
      .toBuffer();
  } catch {
    throw new ListingError(
      "This photo could not be safely decoded. Use a JPEG, PNG or WebP.",
      422,
    );
  }
}
export async function uploadListingPhoto(
  db: Firestore,
  bucket: Bucket,
  uid: string,
  listingId: string,
  bytes: Buffer,
) {
  if (![uid, listingId].every((v) => /^[a-zA-Z0-9_-]{1,128}$/.test(v)))
    throw new ListingError("Invalid listing.");
  const listing = db.doc(`listings/${listingId}`),
    id = randomUUID(),
    record = listing.collection("photos").doc(id);
  const object = `listing-images/${uid}/${listingId}/${id}.jpg`,
    now = Date.now();
  await db.runTransaction(async (tx) => {
    const [parent, restriction, quota] = await Promise.all([
      tx.get(listing),
      tx.get(db.doc(`restrictions/${uid}`)),
      tx.get(db.doc(`postingLimits/${uid}/photoQuota/current`)),
    ]);
    const old = parent.data();
    if (
      restriction.data()?.suspended ||
      (old &&
        (old.ownerId !== uid || !["draft", "published"].includes(old.status)))
    )
      throw new ListingError("You cannot upload to this advert.", 403);
    const previous = quota.data(),
      count = previous?.startedAt > now - 86400000 ? previous!.count : 0;
    if (count >= 24)
      throw new ListingError(
        "Daily photo upload limit reached. Try again tomorrow.",
        429,
      );
    tx.set(quota.ref, {
      startedAt: count ? previous!.startedAt : now,
      count: count + 1,
    });
    tx.create(record, {
      id,
      listingId,
      uploaderId: uid,
      path: object,
      createdAt: now,
      status: "processing",
    });
  });
  const downloadToken = randomUUID();
  let saved = false;
  try {
    const clean = await sanitizePhoto(bytes);
    await bucket.file(object).save(clean, {
      resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: {
        contentType: "image/jpeg",
        cacheControl: "private, no-store",
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      },
    });
    saved = true;
    const [metadata] = await bucket.file(object).getMetadata();
    await db.runTransaction(async (tx) => {
      const [parent, restriction, current] = await Promise.all([
        tx.get(listing),
        tx.get(db.doc(`restrictions/${uid}`)),
        tx.get(record),
      ]);
      const old = parent.data();
      if (
        current.data()?.status !== "processing" ||
        restriction.data()?.suspended ||
        (old &&
          (old.ownerId !== uid || !["draft", "published"].includes(old.status)))
      )
        throw new ListingError("Advert changed during upload.", 409);
      tx.update(record, {
        status: "ready",
        generation: String(metadata.generation),
        size: clean.length,
        validatedAt: Date.now(),
        validationVersion: 1,
      });
    });
    const endpoint =
      process.env.STORAGE_EMULATOR_HOST ||
      "https://firebasestorage.googleapis.com";
    return {
      url: `${endpoint}/v0/b/${bucket.name}/o/${encodeURIComponent(object)}?alt=media&token=${downloadToken}`,
      id,
    };
  } catch (error) {
    if (saved) await bucket.file(object).delete({ ignoreNotFound: true });
    await record.update({ status: "failed" });
    throw error;
  }
}
