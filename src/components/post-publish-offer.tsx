"use client";
import Link from "next/link";
import type { User } from "firebase/auth";
import { PromotionManager } from "./promote-listing";
export function PostPublishOffer({ user, listingId, slug }: { user: User; listingId: string; slug: string }) {
  return <div className="post-publish-offer">
    <h2>Want more riders to see your advert?</h2>
    <p>Your listing is already published. Promotion is optional; listing your item is free.</p>
    <PromotionManager user={user} listingId={listingId} />
    <p><Link className="button-secondary" href={`/listing/${encodeURIComponent(listingId)}/${encodeURIComponent(slug)}`}>Skip for now — view your listing</Link></p>
  </div>;
}
