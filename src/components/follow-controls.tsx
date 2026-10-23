"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { setFollowing } from "@/lib/follows";
import { useSession } from "./session";
export function FollowControls({ uid }: { uid: string }) {
  const { user, loading } = useSession();
  const [counts, setCounts] = useState<{
    followers: number;
    following: number;
  } | null>(null);
  const [followed, setFollowed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const [followers, following, relationship] = await Promise.all([
      getCountFromServer(collection(db, "profiles", uid, "followers")),
      getCountFromServer(collection(db, "profiles", uid, "following")),
      user && user.uid !== uid
        ? getDoc(doc(db, "profiles", user.uid, "following", uid))
        : Promise.resolve(null),
    ]);
    return {
      counts: {
        followers: followers.data().count,
        following: following.data().count,
      },
      followed: relationship?.exists() || false,
    };
  }, [uid, user]);
  useEffect(() => {
    let active = true;
    setCounts(null);
    setFollowed(null);
    setError("");
    load()
      .then((result) => {
        if (active) {
          setCounts(result.counts);
          setFollowed(result.followed);
        }
      })
      .catch(() => {
        if (active) setError("Could not load follows. Refresh to try again.");
      });
    return () => {
      active = false;
    };
  }, [load]);
  return (
    <div className="follow-controls">
      <div className="follow-actions">
        <Link href={`/seller/${uid}/connections?tab=followers`}>
          <strong>{counts?.followers ?? "—"}</strong> Followers
        </Link>
        <Link href={`/seller/${uid}/connections?tab=following`}>
          <strong>{counts?.following ?? "—"}</strong> Following
        </Link>
        {!loading && !user && (
          <Link
            className="button"
            href={`/auth?next=${encodeURIComponent(`/seller/${uid}`)}`}
          >
            Sign in to follow
          </Link>
        )}
        {user && user.uid !== uid && (
          <button
            className={followed ? "button-secondary" : "button"}
            disabled={busy || followed === null}
            aria-pressed={followed ?? false}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const next = !followed;
                await setFollowing(db, user.uid, uid, next);
                setFollowed(next);
                try {
                  const result = await load();
                  setCounts(result.counts);
                  setFollowed(result.followed);
                } catch {
                  setError(
                    "Follow preference saved. Refresh to update totals.",
                  );
                }
              } catch {
                setError("Could not update your follow. Please try again.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy
              ? "Saving…"
              : followed === null
                ? "Loading…"
                : followed
                  ? "Unfollow"
                  : "Follow rider"}
          </button>
        )}
      </div>
      <small>Followers and following lists are public.</small>
      {error && (
        <p role="status" className="notice">
          {error}
        </p>
      )}
    </div>
  );
}
