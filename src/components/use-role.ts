"use client";
import { useEffect, useState } from "react";
import { onIdTokenChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useSession } from "./session";
export function useRole() {
  const { user, loading } = useSession();
  const [state, setState] = useState({ uid: "", admin: false, moderator: false, error: "" });
  useEffect(() => {
    let active = true, generation = 0;
    setState({ uid: "", admin: false, moderator: false, error: "" });
    if (!user) return;
    const stop = onIdTokenChanged(auth, async (current) => {
      const version = ++generation;
      if (!current || current.uid !== user.uid) {
        setState({ uid: "", admin: false, moderator: false, error: "" });
        return;
      }
      try {
        const token = await current.getIdTokenResult();
        if (active && version === generation) setState({ uid: current.uid, admin: token.claims.admin === true, moderator: token.claims.admin === true || token.claims.moderator === true, error: "" });
      } catch {
        if (active && version === generation) setState({ uid: user.uid, admin: false, moderator: false, error: "Your account permissions could not be checked. Refresh your session and retry." });
      }
    });
    // Refresh once on identity change; token events themselves never force-refresh.
    void user.getIdToken(true).catch(() => {
      if (active) setState({ uid: user.uid, admin: false, moderator: false, error: "Your account permissions could not be refreshed. Sign out and back in." });
    });
    return () => { active = false; generation++; stop(); };
  }, [user]);
  const matched = !!user && state.uid === user.uid;
  return { admin: matched && state.admin, moderator: matched && state.moderator, checking: loading || (!!user && !matched), error: matched ? state.error : "", user };
}
