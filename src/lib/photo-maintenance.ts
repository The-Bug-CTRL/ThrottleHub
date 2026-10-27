import { FieldPath, type Firestore } from "firebase-admin/firestore";
import type { Bucket } from "@google-cloud/storage";
export async function pruneAbandonedPhotos(
  db: Firestore,
  bucket: Bucket,
  apply = false,
  now = Date.now(),
) {
  const base = db
    .collectionGroup("photos")
    .where("status", "in", ["processing", "ready", "failed", "discarded"])
    .where("createdAt", "<", now - 86400000)
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
        data.listingId !== parent.id ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(data.uploaderId || "") ||
        !/^[a-f0-9-]{36}$/.test(snapshot.id)
      )
        continue;
      const object = `listing-images/${data.uploaderId}/${parent.id}/${snapshot.id}.jpg`;
      const claimed = await db.runTransaction(async (tx) => {
        const [r, l] = await Promise.all([
            tx.get(snapshot.ref),
            tx.get(parent),
          ]),
          v = r.data();
        if (!v || v.createdAt >= now - 86400000) return false;
        const images = l.data()?.images || [];
        // A malformed reference is retained for operator review, never guessed away.
        for (const image of images) {
          try {
            if (
              decodeURIComponent(new URL(image).pathname).endsWith(
                "/o/" + object,
              )
            )
              return false;
          } catch {
            return false;
          }
        }
        if (apply) tx.update(snapshot.ref, { status: "discarded" });
        return true;
      });
      if (!claimed) continue;
      eligible++;
      if (apply) {
        await bucket.file(object).delete({ ignoreNotFound: true });
        await snapshot.ref.delete();
        deleted++;
      }
    }
    last = page.docs.at(-1);
    if (page.size < 100) break;
  }
  return { scanned, eligible, deleted, dryRun: !apply };
}
