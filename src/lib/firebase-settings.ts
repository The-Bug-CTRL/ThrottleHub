// Explicit modes: a demo- ID is Firebase's offline safety mechanism, not sample content.
export const firebaseMode = process.env.NEXT_PUBLIC_FIREBASE_MODE;
export const firebaseProjectId =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
export const firebaseConfig = {
  projectId: firebaseProjectId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || undefined,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || undefined,
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
};
export const configurationError = !["emulator", "development"].includes(
  firebaseMode || "",
)
  ? "Firebase configuration is missing. Choose an explicit emulator or development mode in .env.local."
  : firebaseMode === "emulator" && !firebaseProjectId.startsWith("demo-")
    ? "Local Firebase must use a demo- project ID to prevent cloud access."
    : !firebaseProjectId ||
        !firebaseConfig.apiKey ||
        !firebaseConfig.authDomain ||
        !firebaseConfig.storageBucket
      ? "Firebase configuration is incomplete. Provide the project ID, web API key, auth domain and storage bucket."
      : firebaseMode === "development" &&
          (firebaseProjectId.startsWith("demo-") ||
            process.env.NEXT_PUBLIC_FIREBASE_DEV_PROJECT_ID !==
              firebaseProjectId)
        ? "Development project safeguard: explicitly confirm the same cloud project ID in NEXT_PUBLIC_FIREBASE_DEV_PROJECT_ID."
        : "";
