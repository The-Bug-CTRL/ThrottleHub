import type { Firestore } from "firebase-admin/firestore";
import { importedVideo } from "./imported-video";
import {
  importedNews,
  importedRace,
  todayZA,
  sameFilter,
  isSouthAfrican,
} from "./imported-content";
export type ContentFilters = {
  cursor?: string;
  category?: string;
  search?: string;
  country?: string;
  province?: string;
  discipline?: string;
  level?: string;
  past?: boolean;
};
// Each request reads at most 96 records, returns at most 12. Filtered sparse pages
// can be empty with a continuation. No whole-collection downloads or health data.
export async function importedFeed(
  db: Firestore,
  kind: "news" | "races" | "videos",
  filters: ContentFilters = {},
) {
  const collection = db.collection(
    kind === "news"
      ? "contentNews"
      : kind === "videos"
        ? "contentVideos"
        : "contentRaces",
  );
  let q = collection.orderBy(
    kind !== "races" ? "publishedAt" : "startDate",
    kind !== "races" || filters.past ? "desc" : "asc",
  );
  if (filters.cursor) {
    if (!/^[a-zA-Z0-9_-]{1,200}$/.test(filters.cursor))
      throw Error("Invalid cursor");
    const cursor = await collection.doc(filters.cursor).get();
    if (!cursor.exists) throw Error("Invalid cursor");
    q = q.startAfter(cursor);
  }
  const snap = await q.limit(96).get();
  const items = [],
    categories = new Set<string>();
  let last = "",
    consumed = 0;
  for (const doc of snap.docs) {
    last = doc.id;
    consumed++;
    if (kind === "videos") {
      const item = importedVideo(doc.id, doc.data());
      if (!item) continue;
      if (item.category) categories.add(item.category);
      if (!sameFilter(item.category, filters.category || "")) continue;
      items.push(item);
    } else if (kind === "news") {
      const item = importedNews(doc.id, doc.data());
      if (!item) continue;
      if (item.category) categories.add(item.category);
      if (!sameFilter(item.category, filters.category || "")) continue;
      const words = (filters.search || "")
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      if (
        !words.every((w) =>
          `${item.title} ${item.summary} ${item.publisher}`
            .toLowerCase()
            .includes(w),
        )
      )
        continue;
      items.push(item);
    } else {
      const item = importedRace(doc.id, doc.data());
      if (
        !item ||
        (filters.past ? item.endDate >= todayZA() : item.endDate < todayZA())
      )
        continue;
      if (filters.country === "za" && !isSouthAfrican(item.country)) continue;
      if (
        filters.country === "international" &&
        (!item.country || isSouthAfrican(item.country))
      )
        continue;
      if (
        !sameFilter(item.province, filters.province || "") ||
        !sameFilter(item.discipline, filters.discipline || "") ||
        !sameFilter(item.level, filters.level || "")
      )
        continue;
      items.push(item);
    }
    if (items.length === 12) break;
  }
  return {
    items,
    categories: [...categories].sort(),
    cursor: consumed < snap.size || snap.size === 96 ? last : null,
  };
}
