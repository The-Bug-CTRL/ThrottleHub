import { FieldPath, type Firestore } from "firebase-admin/firestore";
import type { Bucket } from "@google-cloud/storage";
import { requiresRunningVideo, legacyCategory } from "./taxonomy";
import { videoIsReady } from "./running-video";
export async function auditLegacyMotorcycleVideos(db: Firestore) {
  const base = db
    .collection("listings")
    .where("status", "==", "published")
    .orderBy(FieldPath.documentId());
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined,
    scanned = 0;
  const missing: string[] = [];
  while (true) {
    const page = await (last ? base.startAfter(last) : base).limit(200).get();
    if (page.empty) break;
    for (const snapshot of page.docs) {
      const v = snapshot.data();
      scanned++;
      const category =
        v.categoryId || legacyCategory(v.category, v.subcategory);
      if (
        requiresRunningVideo(category) &&
        !videoIsReady(v.runningVideo, v.ownerId, snapshot.id)
      )
        missing.push(snapshot.id);
    }
    last = page.docs.at(-1);
    if (page.size < 200) break;
  }
  return { scanned, missingVideoListingIds: missing, writes: 0 };
}
export async function pruneAbandonedVideos(
  db: Firestore,
  bucket: Bucket,
  apply = false,
  now = Date.now(),
) {
  const base = db
    .collectionGroup("videos")
    .where("status", "in", [
      "uploading",
      "processing",
      "failed",
      "ready",
      "discarded",
    ])
    .where("createdAt", "<", now - 24 * 3600000)
    .orderBy("createdAt")
    .orderBy(FieldPath.documentId());
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined,
    scanned = 0,
    eligible = 0,
    deleted = 0;
  while (true) {
    const page = await (last ? base.startAfter(last) : base).limit(100).get();
    if (page.empty) break;
    for (const snapshot of page.docs) {
      scanned++;
      const data = snapshot.data(),
        parent = snapshot.ref.parent.parent;
      if (
        !parent ||
        parent.parent.id !== "listings" ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(data.uploaderId || "") ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(snapshot.id) ||
        data.listingId !== parent.id
      )
        continue;
      const claimed = await db.runTransaction(async (tx) => {
        const [record, listing] = await Promise.all([
            tx.get(snapshot.ref),
            tx.get(parent),
          ]),
          v = record.data();
        if (
          !v ||
          v.createdAt >= now - 24 * 3600000 ||
          listing.data()?.runningVideoId === snapshot.id ||
          (v.status === "processing" && v.processingAt > now - 3600000)
        )
          return false;
        if (apply) tx.update(snapshot.ref, { status: "discarded" });
        return true;
      });
      if (!claimed) continue;
      eligible++;
      if (apply) {
        for (const root of ["listing-video-uploads", "listing-videos"])
          await bucket
            .file(`${root}/${data.uploaderId}/${parent.id}/${snapshot.id}.mp4`)
            .delete({ ignoreNotFound: true });
        await snapshot.ref.delete();
        deleted++;
      }
    }
    last = page.docs.at(-1);
    if (page.size < 100) break;
  }
  return { scanned, eligible, deleted, dryRun: !apply };
}
