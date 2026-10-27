import { publicPhone } from "./public-phone";
import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { ListingError } from "./listing-lifecycle";
import { isPublicListing } from "./listing-history";
import type { Listing } from "./models";
export const engagementEvents = ["view", "phone", "message"] as const;
export type EngagementEvent = (typeof engagementEvents)[number];
export async function recordEngagement(
  db: Firestore,
  id: string,
  event: EngagementEvent,
  visitor: string,
  uid?: string,
  now = Date.now(),
) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id) || !engagementEvents.includes(event))
    throw new ListingError("Invalid advert interaction.");
  const listing = db.doc(`listings/${id}`),
    stats = db.doc(`listingStats/${id}`),
    identity = createHash("sha256").update(visitor).digest("hex");
  const seen = stats.collection("engagementVisitors").doc(identity),
    day = Math.floor((now + 2 * 3600000) / 86400000);
  return db.runTransaction(async (tx) => {
    const parent = await tx.get(listing),
      l = parent.data();
    if (!l || !isPublicListing(l as Listing))
      throw new ListingError("Advert unavailable.", 404);
    if (event !== "view" && l.status !== "published")
      throw new ListingError("This advert is not accepting enquiries.", 409);
    let phone = "";
    if (event === "phone") {
      phone = publicPhone(
        (await tx.get(db.doc(`profiles/${l.ownerId}`))).data(),
      );
      if (!phone)
        throw new ListingError(
          "No public number added. Please message the seller instead.",
          404,
        );
    }
    if (uid === l.ownerId) return { phone, recorded: false };
    const [previous, total] = await Promise.all([tx.get(seen), tx.get(stats)]),
      data = total.data() || {},
      last = previous.data() || {};
    if (last[event] === day) return { phone, recorded: false };
    const today = data.day === day ? Number(data.dailyEvents) || 0 : 0;
    // A coarse distributed cost ceiling, not a claim of bot/fraud prevention.
    if (today >= 10000) return { phone, recorded: false };
    tx.set(stats, {
      ...data,
      [event]: (Number(data[event]) || 0) + 1,
      day,
      dailyEvents: today + 1,
      updatedAt: now,
    });
    tx.set(seen, { ...last, [event]: day, lastSeenAt: now });
    return { phone, recorded: true };
  });
}
export async function sellerListingStats(
  db: Firestore,
  id: string,
  uid: string,
) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id))
    throw new ListingError("Invalid advert.");
  const listing = await db.doc(`listings/${id}`).get();
  if (!listing.exists || listing.data()?.ownerId !== uid)
    throw new ListingError("Only the seller can see these stats.", 403);
  const [stats, favourites] = await Promise.all([
    db.doc(`listingStats/${id}`).get(),
    db.collectionGroup("favourites").where("listingId", "==", id).count().get(),
  ]);
  const d = stats.data();
  return {
    views: Number(d?.view) || 0,
    phoneReveals: Number(d?.phone) || 0,
    messageClicks: Number(d?.message) || 0,
    favourites: favourites.data().count,
  };
}
