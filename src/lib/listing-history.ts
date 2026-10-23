import type { Listing } from "./models";

export const publicListingStatuses = [
  "published",
  "sold",
  "expired",
  "on-hold",
] as const;
export const statusLabel = (status: string) =>
  ({
    published: "Active",
    sold: "Sold",
    expired: "Expired",
    "on-hold": "On hold",
    draft: "Draft",
    rejected: "Rejected",
    hidden: "Restricted",
    removed: "Removed",
  })[status] || status;
export const isHistorical = (l: Pick<Listing, "status">) =>
  ["sold", "expired", "on-hold"].includes(l.status);
export const isPublicListing = (
  l: Pick<Listing, "status" | "country" | "currency">,
) =>
  publicListingStatuses.includes(
    l.status as (typeof publicListingStatuses)[number],
  ) &&
  l.country === "ZA" &&
  l.currency === "ZAR";
export function canTransition(from: string, to: string, moderator = false) {
  if (to === "removed") return from !== "removed";
  if (moderator && ["hidden", "rejected"].includes(to))
    return from !== "removed";
  return (
    (
      {
        draft: ["published"],
        published: ["sold", "expired", "on-hold"],
        expired: ["published"],
        "on-hold": ["published", "sold", "expired"],
      } as Record<string, string[]>
    )[from]?.includes(to) ?? false
  );
}
export const listingHref = (l: Pick<Listing, "id" | "slug">) =>
  `/listing/${encodeURIComponent(l.id)}/${encodeURIComponent(l.slug || "item")}`;
