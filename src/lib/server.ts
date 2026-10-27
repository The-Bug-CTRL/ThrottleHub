import { publicListing } from "./public-listing";
import "server-only";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, Query, FieldPath } from "firebase-admin/firestore";
import {
  configurationError,
  firebaseMode,
  firebaseProjectId,
} from "./firebase-settings";
import { Listing } from "./models";
import { isPublicListing } from "./listing-history";
export function adminDb() {
  if (configurationError) throw new Error(configurationError);
  if (
    firebaseMode === "emulator" &&
    process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080"
  )
    throw new Error(
      "Firebase connection configuration error: local Firestore must use 127.0.0.1:8080. Start development with start-dev.bat.",
    );
  if (
    firebaseMode === "development" &&
    (process.env.GCLOUD_PROJECT !== firebaseProjectId ||
      [
        "FIRESTORE_EMULATOR_HOST",
        "FIREBASE_AUTH_EMULATOR_HOST",
        "FIREBASE_STORAGE_EMULATOR_HOST",
        "STORAGE_EMULATOR_HOST",
      ].some((key) => process.env[key]))
  )
    throw new Error(
      "Cloud Firebase configuration mismatch: project IDs must match and emulator endpoints must be unset. Restart with start-dev.bat.",
    );
  const existing = getApps().find((app) => app.name === "[DEFAULT]");
  if (existing && existing.options.projectId !== firebaseProjectId)
    throw new Error(
      "Firebase Admin project changed. Restart the Next.js server before continuing.",
    );
  const app =
    existing ||
    initializeApp({
      projectId: firebaseProjectId,
      ...(firebaseMode === "development"
        ? { credential: applicationDefault() }
        : {}),
    });
  return getFirestore(app);
}
export async function getListing(id: string): Promise<Listing | null> {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return null;
  const snap = await adminDb().collection("listings").doc(id).get();
  if (!snap.exists || !isPublicListing(snap.data() as Listing)) return null;
  return publicListing(snap.data()!, snap.id);
}
export async function getPublicListings(
  category?: string,
  count?: number,
): Promise<Listing[]> {
  let q: Query = adminDb()
    .collection("listings")
    .where("status", "==", "published")
    .where("country", "==", "ZA")
    .where("currency", "==", "ZAR");
  q = category ? q.where("category", "==", category) : q;
  const s = await q
    .orderBy("createdAt", "desc")
    .limit(count ?? (category ? 5 : 4))
    .get();
  return s.docs.map((d) => publicListing(d.data(), d.id));
}
export async function publicDocument(
  collection: string,
  id: string,
  statuses = ["published"],
) {
  const allowed: Record<string, string[]> = {
    forumThreads: ["published"],
    newsArticles: ["published"],
    stolenReports: ["published", "recovered"],
    events: ["published"],
  };
  if (
    !Object.hasOwn(allowed, collection) ||
    !statuses.length ||
    statuses.some((status) => !allowed[collection].includes(status))
  )
    throw new Error("Unsupported public content request.");
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return null;
  let q: Query = adminDb()
    .collection(collection)
    .where(FieldPath.documentId(), "==", id)
    .where("status", "in", statuses);
  if (["events", "stolenReports"].includes(collection))
    q = q.where("country", "==", "ZA");
  const snap = await q.limit(1).get();
  return snap.empty ? null : { ...snap.docs[0].data(), id: snap.docs[0].id };
}
