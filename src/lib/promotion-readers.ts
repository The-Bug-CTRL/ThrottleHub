import type { Firestore, DocumentData } from "firebase-admin/firestore";
import { FieldPath } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import {
  collectionName,
  type PaymentEnvironment,
} from "../../payments-functions/src/core/catalogue";
import {
  eligible,
  entitlementRef,
} from "../../payments-functions/src/core/promotions";
import { publicListing } from "./public-listing";
import type { Listing } from "./models";
import { firestoreQuery } from "./firestore-diagnostics";
export function visibilityEnvironment(): PaymentEnvironment {
  return process.env.NODE_ENV !== "production" &&
    process.env.THROTTLEHUB_PAYSTACK_MODE !== "live" &&
    process.env.THROTTLEHUB_PROMOTION_PREVIEW_TEST === "true"
    ? "test"
    : "live";
}
export type PromotionBadge = {
  featured: boolean;
  test: boolean;
  expiresAt: number;
};
/** Clock-based circular sampling avoids permanently pinning the same featured sellers. */
export async function featuredListings(
  db: Firestore,
  count = 6,
  now = Date.now(),
) {
  const env = visibilityEnvironment(),
    collection = db.collection(collectionName("listingPromotions", env)),
    key = createHash("sha256")
      .update(String(Math.floor(now / 300000)))
      .digest("hex");
  const base = collection
    .where("featuredActive", "==", true)
    .orderBy(FieldPath.documentId());
  const first = await firestoreQuery(
      `featured: ${collection.id} featuredActive=true order=__name__ ASC startAt`,
      () => base.startAt(key).limit(32).get(),
    ),
    second =
      first.size < 32
        ? await firestoreQuery(
            `featured: ${collection.id} featuredActive=true order=__name__ ASC endBefore`,
            () =>
              base
                .endBefore(key)
                .limit(32 - first.size)
                .get(),
          )
        : null;
  const result: Listing[] = [];
  for (const entry of [...first.docs, ...(second?.docs || [])]) {
    const p = entry.data();
    if (p.environment !== env || !p.featuredUntil || p.featuredUntil <= now)
      continue;
    const [listing, restriction] = await Promise.all([
      db.doc(`listings/${p.listingId}`).get(),
      db.doc(`restrictions/${p.uid}`).get(),
    ]);
    if (
      !eligible(listing.data()) ||
      listing.data()?.ownerId !== p.uid ||
      restriction.data()?.suspended
    )
      continue;
    result.push({
      ...publicListing(listing.data()!, listing.id),
      promotion: {
        featured: true,
        test: env === "test",
        expiresAt: p.featuredUntil,
      },
    });
    if (result.length >= count) break;
  }
  return result;
}
export async function activeBumps(
  db: Firestore,
  before?: number,
  limit = 128,
  afterId?: string,
) {
  const env = visibilityEnvironment();
  let q = db
    .collection(collectionName("listingPromotions", env))
    .orderBy("bumpedAt", "desc")
    .orderBy("listingId", "desc");
  if (before !== undefined)
    q = afterId ? q.startAfter(before, afterId) : q.startAt(before);
  const snap = await firestoreQuery(
    `paid bumps: ${collectionName("listingPromotions", env)} order=bumpedAt DESC,listingId DESC cursor=${before === undefined ? "none" : afterId ? "startAfter(time,id)" : "startAt(time)"}`,
    () => q.limit(limit).get(),
  );
  const result = await Promise.all(
    snap.docs.map(async (d) => {
      const p = d.data();
      if (p.environment !== env || !p.bumpActive)
        return { id: p.listingId, value: p.bumpedAt, listing: null };
      const [listing, restriction] = await Promise.all([
        db.doc(`listings/${p.listingId}`).get(),
        db.doc(`restrictions/${p.uid}`).get(),
      ]);
      return {
        id: p.listingId,
        value: p.bumpedAt,
        listing:
          eligible(listing.data()) &&
          listing.data()?.ownerId === p.uid &&
          !restriction.data()?.suspended
            ? ({
                ...listing.data(),
                id: listing.id,
                promotion: {
                  featured: false,
                  test: env === "test",
                  expiresAt: 0,
                },
              } as Listing)
            : null,
      };
    }),
  );
  return { items: result, more: snap.size === limit };
}
export async function currentBump(
  db: Firestore,
  listingId: string,
  environment = visibilityEnvironment(),
): Promise<DocumentData | undefined> {
  return (await entitlementRef(db, environment, listingId).get()).data();
}
export async function organicRanking(db: Firestore, listings: Listing[]) {
  if (!listings.length) return [];
  const states = await db.getAll(
    ...listings.map((l) => entitlementRef(db, visibilityEnvironment(), l.id)),
  );
  return Promise.all(
    listings.map(async (listing, index) => {
      const ranked = { ...listing };
      delete ranked.promotion;
      const p = states[index].data();
      let value = listing.createdAt;
      if (
        p?.environment === visibilityEnvironment() &&
        p?.bumpActive &&
        p.uid === listing.ownerId &&
        p.bumpedAt > value &&
        !(await db.doc(`restrictions/${p.uid}`).get()).data()?.suspended
      ) {
        value = p.bumpedAt;
        ranked.promotion = {
          featured: false,
          test: visibilityEnvironment() === "test",
          expiresAt: 0,
        };
      }
      return { id: listing.id, value, listing: ranked };
    }),
  );
}
/** Input comes only from the trusted ranking readers above, never a raw document. */
export function rankedPublicListing(listing: Listing) {
  return {
    ...publicListing(listing, listing.id),
    ...(listing.promotion ? { promotion: listing.promotion } : {}),
  };
}
