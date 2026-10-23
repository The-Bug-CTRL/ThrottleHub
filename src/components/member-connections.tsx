"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { provinces } from "@/lib/marketplace";
import { MemberAvatar } from "./member-avatar";
import { LoadingState } from "./ui/primitives";
type Member = {
  id: string;
  displayName: string;
  city: string;
  region: string;
  photoURL: string | null;
};
export function MemberConnections({
  uid,
  direction,
}: {
  uid: string;
  direction: "followers" | "following";
}) {
  const [members, setMembers] = useState<Member[]>([]),
    [cursor, setCursor] = useState(""),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  const load = useCallback(
    async (after = "") => {
      const base = collection(db, "profiles", uid, direction);
      const page = await getDocs(
        query(
          base,
          orderBy(documentId()),
          ...(after ? [startAfter(after)] : []),
          limit(21),
        ),
      );
      const rows = page.docs.slice(0, 20);
      const profiles = await Promise.all(
        rows.map(async (edge) => {
          const snapshot = await getDoc(doc(db, "profiles", edge.id));
          if (!snapshot.exists()) return null;
          const p = snapshot.data();
          return {
            id: snapshot.id,
            displayName: p.displayName || "Rider",
            city: p.city || "",
            region: p.region || "",
            photoURL: p.photoURL || null,
          } as Member;
        }),
      );
      return {
        members: profiles.filter((p): p is Member => p !== null),
        cursor: rows.at(-1)?.id || "",
        more: page.docs.length > 20,
      };
    },
    [uid, direction],
  );
  useEffect(() => {
    let active = true;
    setMembers([]);
    setBusy(true);
    setError("");
    setMore(false);
    load()
      .then((page) => {
        if (active) {
          setMembers(page.members);
          setCursor(page.cursor);
          setMore(page.more);
        }
      })
      .catch(() => {
        if (active)
          setError("Could not load these riders. Please refresh to try again.");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [load]);
  return (
    <>
      {busy && !members.length && <LoadingState label="Loading riders…" />}
      {error && (
        <p role="status" className="notice">
          {error}
        </p>
      )}
      {!busy && !error && !members.length && (
        <p>No riders here yet. Follow a rider from their public profile.</p>
      )}
      <div className="member-connections-grid">
        {members.map((member) => (
          <article className="member-connection" key={member.id}>
            <MemberAvatar user={member} size={48} />
            <div>
              <Link href={`/seller/${member.id}`}>
                <h2>{member.displayName}</h2>
              </Link>
              <p>
                {[
                  member.city,
                  provinces[member.region as keyof typeof provinces],
                ]
                  .filter(Boolean)
                  .join(", ") || "Location not shared"}
              </p>
              <div className="member-connection-links">
                <Link href={`/seller/${member.id}#listings`}>
                  View listings
                </Link>
                <Link href={`/seller/${member.id}#reviews`}>Reviews</Link>
              </div>
            </div>
          </article>
        ))}
      </div>
      {more && (
        <button
          className="button load-more"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const page = await load(cursor);
              setMembers((old) => [...old, ...page.members]);
              setCursor(page.cursor);
              setMore(page.more);
            } catch {
              setError("Could not load more riders. Please try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Loading…" : "Load more riders"}
        </button>
      )}
    </>
  );
}
