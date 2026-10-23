"use client";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import {
  firebaseConfig,
  firebaseMode,
  configurationError,
} from "./firebase-settings";
const fresh = !getApps().some((app) => app.name === "[DEFAULT]");
// Inert emulator-only initialization keeps imports safe if configuration is absent.
// Shell blocks all interactions; server readers reject rather than substituting data.
const existing = getApps().find((app) => app.name === "[DEFAULT]");
if (
  existing &&
  existing.options.projectId !==
    (configurationError ? "demo-unconfigured" : firebaseConfig.projectId)
)
  throw new Error(
    "Firebase project changed. Refresh the page after restarting the development server.",
  );
const app =
  existing ||
  initializeApp(
    configurationError
      ? {
          projectId: "demo-unconfigured",
          apiKey: "unconfigured",
          authDomain: "demo-unconfigured.firebaseapp.com",
          storageBucket: "demo-unconfigured.appspot.com",
        }
      : firebaseConfig,
  );
export const auth = getAuth(app),
  db = getFirestore(app),
  storage = getStorage(app);
if (fresh && (firebaseMode === "emulator" || configurationError)) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}
