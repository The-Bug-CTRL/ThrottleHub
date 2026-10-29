import { publicListing } from "./public-listing";
import { FieldPath, Firestore, Query } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { categoryById } from "./taxonomy";
import {
  Filters,
  matchesListing,
  SearchCursor,
  validateFilters,
  searchWords,
} from "./search-contract";
import type { Listing } from "./models";
import {
  activeBumps,
  organicRanking,
  rankedPublicListing,
} from "./promotion-readers";
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
    base = base.where("searchTokens", "array-contains", searchWords(f.term)[0]);
  if (field === "price") {
    if (f.min) base = base.where("price", ">=", +f.min);
    if (f.max) base = base.where("price", "<=", +f.max);
  }
  base = base
    .orderBy(field, direction)
    .orderBy(FieldPath.documentId(), direction);
  if (f.sort === "newest") {
    const organic = await (after ? base.startAt(after.value) : base)
      .limit(128)
      .get();
    const bumps = await activeBumps(db, after?.value, 128, after?.id);
    const candidates = new Map<
      string,
      { id: string; value: number; listing: Listing | null }
    >();
    for (const item of await organicRanking(
      db,
      organic.docs.map((doc) => ({ ...doc.data(), id: doc.id }) as Listing),
    ))
      candidates.set(item.id, item);
    for (const bump of bumps.items) {
      const old = candidates.get(bump.id);
      if (!old || (bump.listing && bump.value > old.value))
        candidates.set(bump.id, bump);
    }
    const sorted = [...candidates.values()]
      .filter(
        (c) =>
          !after ||
          c.value < after.value ||
          (c.value === after.value && c.id < after.id),
      )
      .sort(
        (a, b) =>
          b.value - a.value || (a.id === b.id ? 0 : a.id < b.id ? 1 : -1),
      );
    const items: Listing[] = [];
    let cursor = after,
      scanned = 0;
    for (const item of sorted) {
      cursor = { value: item.value, id: item.id, fingerprint };
      scanned++;
      if (item.listing && matchesListing(item.listing, f))
        items.push(rankedPublicListing(item.listing));
      if (items.length === 8 || scanned === 128) break;
    }
    return {
      items,
      cursor,
      more: scanned < sorted.length || organic.size === 128 || bumps.more,
      scanned,
    };
  }
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
      if (matchesListing(l, f)) items.push(publicListing(doc.data(), doc.id));
      if (items.length === 8 || scanned === 128) break;
    }
    more = processed < snap.size || snap.size === 32;
  }
  return { items, cursor, more, scanned };
}
