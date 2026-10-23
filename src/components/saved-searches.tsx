"use client";
import { LoadingState } from "@/components/ui/primitives";
import { RoostLoader } from "@/components/loading/roost-loader";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Filters, filtersUrl, validateFilters } from "@/lib/search-contract";
import { categoryById } from "@/lib/taxonomy";
import { useSession } from "./session";
export function SaveSearch({ filters }: { filters: Filters }) {
  const { user } = useSession();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="save-search">
      <button
        type="button"
        disabled={busy}
        className="button-secondary"
        onClick={async () => {
          if (!user) {
            setMessage("Sign in to save searches.");
            return;
          }
          setBusy(true);
          try {
            validateFilters(filters);
            await addDoc(collection(db, "users", user.uid, "savedSearches"), {
              name: [
                categoryById[filters.category]?.name || "All categories",
                filters.make,
                filters.model,
                filters.term,
              ]
                .filter(Boolean)
                .join(" · ")
                .slice(0, 160),
              filters,
              createdAt: Date.now(),
              notificationsEnabled: false,
              version: 2,
            });
            setMessage("Search saved. Notifications are not enabled.");
          } catch (e) {
            setMessage(
              e instanceof Error ? e.message : "Could not save search.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy && <RoostLoader size={40} label="Saving search" />} Save this
        search
      </button>{" "}
      <Link href={user ? "/account/saved-searches" : "/auth"}>
        {user ? "Manage saved searches" : "Sign in"}
      </Link>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
type Saved = { id: string; name: string; filters: Filters };
export function SavedSearches() {
  const { user, loading } = useSession();
  const [items, setItems] = useState<Saved[]>([]);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState<QueryDocumentSnapshot>();
  const [more, setMore] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    let active = true;
    setFetching(true);
    setError("");
    getDocs(
      query(
        collection(db, "users", user.uid, "savedSearches"),
        orderBy("createdAt", "desc"),
        limit(20),
      ),
    )
      .then((s) => {
        if (active) {
          setItems(s.docs.map((d) => ({ ...d.data(), id: d.id }) as Saved));
          setCursor(s.docs.at(-1));
          setMore(s.size === 20);
        }
      })
      .catch(() => {
        if (active) setError("Could not load saved searches.");
      })
      .finally(() => {
        if (active) setFetching(false);
      });
    return () => {
      active = false;
    };
  }, [user]);
  if (loading) return <LoadingState label="Loading account…" />;
  if (!user)
    return (
      <p>
        <Link href="/auth">Sign in</Link> to manage saved searches.
      </p>
    );
  return (
    <>
      <p>
        Reopen or remove your saved criteria. Email and push notifications are
        not enabled.
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {fetching && <LoadingState label="Loading saved searches…" />}
      {!fetching && !error && !items.length && (
        <p>
          No saved searches yet.{" "}
          <Link href="/browse">Explore the marketplace</Link>.
        </p>
      )}
      {items.map((s) => (
        <article key={s.id} className="saved-search-row">
          <div>
            <h2>{s.name}</h2>
            <Link className="text-button" href={filtersUrl(s.filters)}>
              Run this search →
            </Link>
          </div>
          <button
            onClick={async () => {
              try {
                await deleteDoc(
                  doc(db, "users", user.uid, "savedSearches", s.id),
                );
                setItems((old) => old.filter((i) => i.id !== s.id));
              } catch {
                setError("Could not remove search.");
              }
            }}
          >
            Remove
          </button>
        </article>
      ))}
      {more && (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const s = await getDocs(
                query(
                  collection(db, "users", user.uid, "savedSearches"),
                  orderBy("createdAt", "desc"),
                  startAfter(cursor!),
                  limit(20),
                ),
              );
              setItems((old) => [
                ...old,
                ...s.docs.map((d) => ({ ...d.data(), id: d.id }) as Saved),
              ]);
              setCursor(s.docs.at(-1));
              setMore(s.size === 20);
            } catch {
              setError("Could not load more searches.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy && <RoostLoader size={40} label="Loading more searches" />} Load
          more searches
        </button>
      )}
    </>
  );
}
