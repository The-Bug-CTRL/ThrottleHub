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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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
  return (
    <Context.Provider value={{ user, loading, logout: () => signOut(auth) }}>
      {children}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);
