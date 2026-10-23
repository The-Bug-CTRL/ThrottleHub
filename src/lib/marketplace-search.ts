import { FieldPath, Firestore, Query } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { categoryById } from "./taxonomy";
import {
  Filters,
  matchesListing,
  SearchCursor,
  validateFilters,
} from "./search-contract";
import type { Listing } from "./models";
// Indexed candidates with bounded server refinement; sparse matches may need another page.
export async function queryMarketplace(
  db: Firestore,
  input: Filters,
  after?: SearchCursor,
) {
  const f = validateFilters(input);
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(f))
    .digest("hex")
    .slice(0, 24);
  if (
    after &&
    (after.fingerprint !== fingerprint ||
      !Number.isFinite(after.value) ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(after.id))
  )
    throw Error("Search changed. Start again from the first page.");
  const field = f.sort.startsWith("price") ? "price" : "createdAt";
  const direction =
    f.sort === "oldest" || f.sort === "price-asc" ? "asc" : "desc";
  let base: Query = db
    .collection("listings")
    .where("status", "==", "published")
    .where("country", "==", "ZA")
    .where("currency", "==", "ZAR");
  if (f.region) base = base.where("region", "==", f.region);
  if (f.category)
    base = base.where(
      `categoryPath.l${categoryById[f.category].level}`,
      "==",
      f.category,
    );
  if (f.term)
    base = base.where(
      "searchTokens",
      "array-contains",
      f.term.trim().toLowerCase(),
    );
  if (field === "price") {
    if (f.min) base = base.where("price", ">=", +f.min);
    if (f.max) base = base.where("price", "<=", +f.max);
  }
  base = base
    .orderBy(field, direction)
    .orderBy(FieldPath.documentId(), direction);
  let cursor = after,
    scanned = 0,
    more = true;
  const items: Listing[] = [];
  while (items.length < 8 && scanned < 128 && more) {
    let page = base;
    if (cursor) page = page.startAfter(cursor.value, cursor.id);
    const snap = await page.limit(32).get();
    if (snap.empty) {
      more = false;
      break;
    }
    let processed = 0;
    for (const doc of snap.docs) {
      const l = { ...doc.data(), id: doc.id } as Listing;
      cursor = { value: l[field], id: doc.id, fingerprint };
      scanned++;
      processed++;
      if (matchesListing(l, f)) items.push(l);
      if (items.length === 8 || scanned === 128) break;
    }
    more = processed < snap.size || snap.size === 32;
  }
  return { items, cursor, more, scanned };
}
