import type { Firestore } from "firebase-admin/firestore";
import type { Bucket } from "@google-cloud/storage";

// Run only after the caller is authorised by mutateListing. Jobs contain no photo URLs or free text.
export async function finishListingMedia(
  db: Firestore,
  id: string,
  bucket: Bucket,
) {
  const ref = db.collection("listings").doc(id);
  const pending = await ref.collection("mediaCleanup").doc("pending").get();
  if (pending.exists) {
    const owner = pending.data()!.ownerId;
    if (typeof owner !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(owner))
      throw new Error("Invalid media owner.");
    const prefix = `listing-images/${owner}/${id}/`;
    const restrictedPrefix = `listing-restricted/${owner}/${id}/`;
    // Restriction/removal revokes public video token URLs by deleting accepted originals.
    // Video records are private and retained only while the ordinary advert remains public/draft.
    await bucket.deleteFiles({
      prefix: `listing-videos/${owner}/${id}/`,
      force: true,
    });
    await bucket.deleteFiles({
      prefix: `listing-video-uploads/${owner}/${id}/`,
      force: true,
    });
    await db.recursiveDelete(ref.collection("videos"));
    await db.recursiveDelete(ref.collection("photos"));
    if (pending.data()!.mode === "restrict") {
      const [files] = await bucket.getFiles({ prefix });
      for (const file of files) {
        const [metadata] = await file.getMetadata();
        const [bytes] = await file.download();
        // Write a new private object without copying public bearer tokens.
        // Keep only the content type; Storage rules deny the restricted prefix.
        await bucket
          .file(restrictedPrefix + file.name.slice(prefix.length))
          .save(bytes, {
            resumable: false,
            metadata: {
              contentType: metadata.contentType,
              cacheControl: "private, no-store, max-age=0",
            },
          });
        await file.delete({ ignoreNotFound: true });
      }
    } else {
      await bucket.deleteFiles({ prefix, force: true });
      await bucket.deleteFiles({ prefix: restrictedPrefix, force: true });
    }
  }
  const listing = await ref.get();
  if (listing.data()?.status === "removed") {
    await db.recursiveDelete(ref.collection("history"));
  }
  await db.runTransaction(async (tx) => {
    const currentJob = await tx.get(pending.ref);
    const currentListing = await tx.get(ref);
    if (
      pending.exists !== currentJob.exists ||
      (pending.exists && !pending.updateTime!.isEqual(currentJob.updateTime!))
    )
      throw new Error("A newer cleanup request is pending. Retry cleanup.");
    if (currentListing.data()?.status === "removed") {
      if (
        (pending.exists && pending.data()!.mode === "restrict") ||
        (!pending.exists && currentListing.data()?.ownerId)
      )
        throw new Error("Removal cleanup still pending.");
      tx.update(ref, { ownerId: "" });
    }
    if (pending.exists) tx.delete(pending.ref);
  });
}
