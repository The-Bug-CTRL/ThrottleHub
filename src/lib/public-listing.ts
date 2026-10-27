import type { Listing } from "./models";
// Shared allowlist for every Admin-backed marketplace response.
export function publicListing(
  data: Record<string, unknown>,
  id: string,
): Listing {
  const keys = [
    "runningVideo",
    "runningVideoId",
    "sellerAccountType",
    "ownerId",
    "slug",
    "title",
    "description",
    "category",
    "subcategory",
    "make",
    "model",
    "year",
    "price",
    "currency",
    "country",
    "region",
    "city",
    "condition",
    "shipping",
    "specs",
    "images",
    "status",
    "createdAt",
    "updatedAt",
    "categoryId",
    "primaryCategoryId",
    "categoryAncestorIds",
    "categoryPath",
    "details",
    "publishedAt",
    "soldAt",
    "expiredAt",
    "lastStatusChangeAt",
    "originalAskingPrice",
    "sellerAnonymised",
  ];
  return {
    ...Object.fromEntries(
      keys.filter((k) => data[k] !== undefined).map((k) => [k, data[k]]),
    ),
    id,
  } as Listing;
}
