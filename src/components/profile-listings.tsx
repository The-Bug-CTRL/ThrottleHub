"use client";
import { useState } from "react";
import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Listing } from "@/lib/models";
import { Card } from "./card";
export function ProfileListings({
  uid,
  initial,
}: {
  uid: string;
  initial: Listing[];
}) {
  const [items, setItems] = useState(initial),
    [more, setMore] = useState(initial.length === 24),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <div className="listing-grid">
        {items.map((l) => (
          <Card key={l.id} listing={l} />
        ))}
      </div>
      {error && (
        <p role="status" className="notice">
          {error}
        </p>
      )}
      {more && (
        <button
          className="button load-more"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const page = await getDocs(
                query(
                  collection(db, "listings"),
                  where("ownerId", "==", uid),
                  where("status", "==", "published"),
                  where("country", "==", "ZA"),
                  where("currency", "==", "ZAR"),
                  orderBy(documentId()),
                  startAfter(items.at(-1)!.id),
                  limit(24),
                ),
              );
              setItems((old) => [
                ...old,
                ...page.docs.map((d) => ({ ...d.data(), id: d.id }) as Listing),
              ]);
              setMore(page.docs.length === 24);
            } catch {
              setError("Could not load more listings. Please try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Loading…" : "More from this rider"}
        </button>
      )}
    </>
  );
}
