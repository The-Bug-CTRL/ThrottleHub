import type { Firestore } from "firebase-admin/firestore";
import type { Bucket } from "@google-cloud/storage";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { inspectRunningVideo, cleanVideoContainer } from "./video-inspection";
import { MAX_VIDEO_BYTES, VIDEO_VALIDATION_VERSION } from "./running-video";
import { ListingError } from "./listing-lifecycle";
const validId = (v: string) => /^[a-zA-Z0-9_-]{1,128}$/.test(v);
async function videoActionInternal(
  db: Firestore,
  bucket: Bucket,
  uid: string,
  listingId: string,
  input: Record<string, unknown>,
) {
  if (!validId(uid) || !validId(listingId))
    throw new ListingError("Invalid listing.");
  const listing = db.collection("listings").doc(listingId);
  const id =
    input.action === "begin" ? randomUUID() : String(input.videoId || "");
  if (!validId(id)) throw new ListingError("Invalid video.");
  const target = listing.collection("videos").doc(id);
  if (input.action === "begin") {
    if (!["petrol", "electric"].includes(String(input.demonstration)))
      throw new ListingError("Choose petrol or electric demonstration.");
    const uploadPath = `listing-video-uploads/${uid}/${listingId}/${id}.mp4`;
    await db.runTransaction(async (tx) => {
      const [old, restriction, quota] = await Promise.all([
        tx.get(listing),
        tx.get(db.doc(`restrictions/${uid}`)),
        tx.get(db.doc(`postingLimits/${uid}/videoQuota/current`)),
      ]);
      if (
        restriction.data()?.suspended ||
        (old.exists &&
          (old.data()?.ownerId !== uid ||
            !["draft", "published", "expired", "on-hold"].includes(
              old.data()?.status,
            )))
      )
        throw new ListingError("You cannot upload to this advert.", 403);
      const now = Date.now(),
        previous = quota.data(),
        count =
          previous && previous.startedAt > now - 3600000 ? previous.count : 0;
      if (count >= 6)
        throw new ListingError(
          "You have started six video uploads this hour. Try again later.",
          429,
        );
      const dayCount =
        previous?.dayStartedAt > now - 86400000 ? previous!.dayCount || 0 : 0;
      if (dayCount >= 12)
        throw new ListingError(
          "You have started twelve video uploads today. Try again tomorrow.",
          429,
        );
      tx.set(quota.ref, {
        startedAt: count ? previous!.startedAt : now,
        count: count + 1,
        dayStartedAt: dayCount ? previous!.dayStartedAt : now,
        dayCount: dayCount + 1,
      });
      tx.create(target, {
        id,
        listingId,
        uploaderId: uid,
        path: uploadPath,
        status: "uploading",
        demonstration: input.demonstration,
        createdAt: now,
        expiresAt: now + 3600000,
      });
    });
    return { id, path: uploadPath };
  }
  const lease = await db.runTransaction(async (tx) => {
    const [record, current, restriction] = await Promise.all([
      tx.get(target),
      tx.get(listing),
      tx.get(db.doc(`restrictions/${uid}`)),
    ]);
    const v = record.data();
    if (
      !v ||
      v.uploaderId !== uid ||
      restriction.data()?.suspended ||
      (current.exists &&
        (current.data()?.ownerId !== uid ||
          !["draft", "published", "expired", "on-hold"].includes(
            current.data()?.status,
          )))
    )
      throw new ListingError("This video is unavailable or not yours.", 403);
    if (input.action === "discard") {
      if (current.data()?.runningVideoId === id || v.status === "processing")
        throw new ListingError(
          "Replace the published video before removing it, or wait for validation.",
          409,
        );
      tx.update(target, { status: "discarded" });
      return v;
    }
    if (
      input.action !== "validate" ||
      v.status !== "uploading" ||
      v.expiresAt < Date.now()
    )
      throw new ListingError(
        "Start a new upload or wait for the current validation.",
        409,
      );
    tx.update(target, { status: "processing", processingAt: Date.now() });
    return v;
  });
  if (input.action === "discard") {
    await bucket.file(lease.path).delete({ ignoreNotFound: true });
    await target.delete();
    return { discarded: true };
  }
  // Runtime-created files are not application assets. Keep the static file tracer
  // from expanding the machine's entire OS temp directory during Next builds.
  const temporaryRoot = Reflect.apply(tmpdir, undefined, []) as string;
  const folder = await mkdtemp(path.join(temporaryRoot, "throttlehub-video-"));
  const acceptedPath = `listing-videos/${uid}/${listingId}/${id}.mp4`;
  let saved = false;
  try {
    const source = bucket.file(lease.path),
      [metadata] = await source.getMetadata();
    if (
      metadata.contentType !== "video/mp4" ||
      !(Number(metadata.size) > 0 && Number(metadata.size) <= MAX_VIDEO_BYTES)
    )
      throw new ListingError("Use an MP4 up to 100 MiB.");
    const local = path.join(folder, "input.mp4");
    await bucket
      .file(lease.path, { generation: metadata.generation })
      .download({ destination: local });
    if ((await stat(local)).size > MAX_VIDEO_BYTES)
      throw new ListingError("Video exceeds 100 MiB.");
    const details = await inspectRunningVideo(local, lease.demonstration);
    const clean = path.join(folder, "accepted.mp4");
    await cleanVideoContainer(local, clean);
    const size = (await stat(clean)).size;
    if (size > MAX_VIDEO_BYTES)
      throw new ListingError(
        "Processed video exceeds 100 MiB. Export a smaller MP4.",
      );
    const destination = bucket.file(acceptedPath);
    await pipeline(
      createReadStream(clean),
      destination.createWriteStream({
        resumable: false,
        preconditionOpts: { ifGenerationMatch: 0 },
        metadata: {
          contentType: "video/mp4",
          cacheControl: "private, no-store, max-age=0",
          metadata: { firebaseStorageDownloadTokens: randomUUID() },
        },
      }),
    );
    saved = true;
    const [accepted] = await destination.getMetadata();
    const ready = {
      id,
      path: acceptedPath,
      uploaderId: uid,
      listingId,
      status: "ready" as const,
      contentType: "video/mp4" as const,
      size,
      ...details,
      demonstration: lease.demonstration,
      validatedAt: Date.now(),
      uploadedAt: metadata.timeCreated
        ? new Date(metadata.timeCreated).getTime()
        : Date.now(),
      createdAt: lease.createdAt,
      validationVersion: VIDEO_VALIDATION_VERSION,
      generation: String(accepted.generation),
    };
    await source.delete({ ignoreNotFound: true });
    await db.runTransaction(async (tx) => {
      const [r, l, restriction] = await Promise.all([
        tx.get(target),
        tx.get(listing),
        tx.get(db.doc(`restrictions/${uid}`)),
      ]);
      if (
        r.data()?.status !== "processing" ||
        restriction.data()?.suspended ||
        (l.exists &&
          (l.data()?.ownerId !== uid ||
            !["draft", "published", "expired", "on-hold"].includes(
              l.data()?.status,
            )))
      )
        throw new ListingError(
          "Advert changed during validation. Upload again.",
          409,
        );
      tx.set(target, ready);
    });
    return ready;
  } catch (error) {
    if (saved) await bucket.file(acceptedPath).delete({ ignoreNotFound: true });
    await target.update({ status: "failed", failedAt: Date.now() });
    throw error;
  } finally {
    if (
      path.dirname(path.resolve(folder)) !== path.resolve(temporaryRoot) ||
      !path.basename(folder).startsWith("throttlehub-video-")
    )
      throw new Error("Unexpected temporary directory.");
    await rm(folder, { recursive: true, force: true });
  }
}
let activeValidators = 0;
export async function videoAction(
  ...args: Parameters<typeof videoActionInternal>
) {
  const validating = args[4].action === "validate";
  if (validating && activeValidators >= 2)
    throw new ListingError("Video checks are busy. Try again shortly.", 429);
  if (validating) activeValidators++;
  try {
    return await videoActionInternal(...args);
  } finally {
    if (validating) activeValidators--;
  }
}
