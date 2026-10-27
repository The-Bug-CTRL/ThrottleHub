"use client";
import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  User,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { configurationError } from "@/lib/firebase-settings";
import { useRouter } from "next/navigation";
import { accountProfile } from "@/lib/profile-client";
// Persistence is established before any sign-in flow starts.
export const authReady =
  configurationError || typeof window === "undefined"
    ? Promise.resolve()
    : setPersistence(auth, browserLocalPersistence);
authReady.catch(() => {});
const Context = createContext<{
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}>({ user: null, loading: true, logout: async () => {} });
export function Session({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  useEffect(() => {
    if (configurationError) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);
  useEffect(() => {
    setProfileError("");
    if (!user) return;
    let active = true;
    accountProfile(user)
      .then((result) => {
        if (active && result.needsSetup && window.location.pathname !== "/auth")
          router.replace("/auth?setup=1");
      })
      .catch((error) => {
        if (active)
          setProfileError(
            error instanceof Error
              ? error.message
              : "Your sign-in worked, but your application profile could not be checked.",
          );
      });
    return () => {
      active = false;
    };
  }, [user, router]);
  return (
    <Context.Provider
      value={{
        user,
        loading,
        logout: async () => {
          await signOut(auth);
          router.replace("/");
          router.refresh();
        },
      }}
    >
      {profileError && (
        <div className="notice error" role="alert">
          {profileError} <a href="/auth?setup=1">Retry account setup</a>
        </div>
      )}
      {children}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);
