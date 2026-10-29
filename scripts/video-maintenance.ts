import { pruneForumMedia } from "../src/lib/forum-media-service";
import { pruneAbandonedPhotos } from "../src/lib/photo-maintenance";
import {
  initializeApp,
  applicationDefault,
  deleteApp,
} from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import {
  pruneAbandonedVideos,
  auditLegacyMotorcycleVideos,
} from "../src/lib/video-maintenance";
async function main() {
  // Load the established environment helper without importing application server initialization.
  const { environment } = await import("./runtime.mjs");
  const env = environment();
  const cloud = env.NEXT_PUBLIC_FIREBASE_MODE === "development";
  if (
    cloud &&
    [
      env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      env.NEXT_PUBLIC_FIREBASE_DEV_PROJECT_ID,
      env.GCLOUD_PROJECT,
    ].some((v) => v !== "throttlehub-9d6b9")
  )
    throw Error("Wrong cloud project");
  if (!cloud && env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== "demo-throttlehub")
    throw Error("Wrong emulator project");
  const apply = process.argv.includes("--apply");
  if (cloud && apply && !process.argv.includes("--approved-cloud-maintenance"))
    throw Error(
      "Cloud deletion requires separate approval and --approved-cloud-maintenance. Default is dry-run.",
    );
  Object.assign(process.env, env);
  const app = initializeApp(
    {
      projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      ...(cloud ? { credential: applicationDefault() } : {}),
    },
    "video-maintenance",
  );
  try {
    const result = process.argv.includes("--audit-legacy")
      ? await auditLegacyMotorcycleVideos(getFirestore(app))
      : {
          videos: await pruneAbandonedVideos(
            getFirestore(app),
            getStorage(app).bucket(),
            apply,
          ),
          ...(process.argv.includes("--all-media")
            ? {
                forum: await pruneForumMedia(
                  getFirestore(app),
                  getStorage(app).bucket(),
                  apply,
                ),
                photos: await pruneAbandonedPhotos(
                  getFirestore(app),
                  getStorage(app).bucket(),
                  apply,
                ),
              }
            : {}),
        };
    console.log(
      JSON.stringify({
        at: new Date().toISOString(),
        project: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        result,
      }),
    );
  } finally {
    await deleteApp(app);
  }
}
void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Video maintenance unavailable",
  );
  process.exitCode = 1;
});
