"use client";
import { useEffect, useState, useCallback } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  QueryConstraint,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { dataError } from "@/lib/errors";
export function usePageQuery<T extends { id: string }>(
  collectionName: string,
  filters: Record<string, string>,
  sort = "createdAt",
  direction: "asc" | "desc" = "desc",
  pageSize = 12,
  statuses = ["published"],
) {
  const [items, setItems] = useState<T[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true),
    [more, setMore] = useState(false),
    [cursor, setCursor] = useState<QueryDocumentSnapshot>();
  const key = JSON.stringify(filters),
    statusKey = JSON.stringify(statuses);
  const fetchPage = useCallback(
    async (append = false, last?: QueryDocumentSnapshot) => {
      setBusy(true);
      setError("");
      try {
        const f = JSON.parse(key) as Record<string, string>;
        if (f.searchTokens && /\s/.test(f.searchTokens))
          throw new Error(
            "Search supports one keyword or prefix. Use categories to refine the results.",
          );
        if (["events", "stolenReports"].includes(collectionName))
          f.country = "ZA";
        const states = JSON.parse(statusKey) as string[];
        const q: QueryConstraint[] = [
          where(
            "status",
            states.length === 1 ? "==" : "in",
            states.length === 1 ? states[0] : states,
          ),
        ];
        for (const [k, v] of Object.entries(f))
          if (v)
            q.push(
              k === "_createdAfter"
                ? where("createdAt", ">=", Number(v))
                : k === "_endsAfter"
                  ? where("endsAt", ">=", Number(v))
                  : k === "_endsBefore"
                    ? where("endsAt", "<", Number(v))
                    : where(
                        k,
                        k === "searchTokens" ? "array-contains" : "==",
                        k === "year" ? Number(v) : v,
                      ),
            );
        q.push(orderBy(sort, direction));
        if (append && last) q.push(startAfter(last));
        q.push(limit(pageSize));
        const snap = await getDocs(query(collection(db, collectionName), ...q));
        setItems((old) =>
          append
            ? [
                ...old,
                ...snap.docs.map((d) => ({ ...d.data(), id: d.id }) as T),
              ]
            : snap.docs.map((d) => ({ ...d.data(), id: d.id }) as T),
        );
        setCursor(snap.docs.at(-1));
        setMore(snap.size === pageSize);
      } catch (e) {
        setError(dataError(e));
        if (!append) setItems([]);
      } finally {
        setBusy(false);
      }
    },
    [key, statusKey, collectionName, sort, direction, pageSize],
  );
  useEffect(() => {
    void fetchPage();
  }, [fetchPage]);
  return {
    items,
    error,
    busy,
    more,
    loadMore: () => fetchPage(true, cursor),
    refresh: () => fetchPage(),
  };
}
