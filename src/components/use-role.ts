"use client";
import { useEffect, useState } from "react";
import { useSession } from "./session";
export function useRole() {
  const { user } = useSession();
  const [admin, setAdmin] = useState(false),
    [moderator, setModerator] = useState(false),
    [checking, setChecking] = useState(true);
  useEffect(() => {
    let active = true;
    setAdmin(false);
    setModerator(false);
    if (!user) {
      setChecking(false);
      return;
    }
    setChecking(true);
    user
      .getIdTokenResult(true)
      .then((t) => {
        if (active) {
          setAdmin(t.claims.admin === true);
          setModerator(t.claims.admin === true || t.claims.moderator === true);
        }
      })
      .catch(() => {
        if (active) {
          setAdmin(false);
          setModerator(false);
        }
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [user]);
  return { admin, moderator, checking, user };
}
