import {
  initializeApp,
  applicationDefault,
  deleteApp,
} from "firebase-admin/app";
import { environment } from "./runtime.mjs";
const env = environment(),
  expected = "throttlehub-9d6b9";
if (
  env.NEXT_PUBLIC_FIREBASE_MODE !== "development" ||
  env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== expected ||
  env.GCLOUD_PROJECT !== expected ||
  env.NEXT_PUBLIC_FIREBASE_DEV_PROJECT_ID !== expected
)
  throw Error(
    "Refusing cloud verification: expected the confirmed throttlehub-9d6b9 cloud profile.",
  );
Object.assign(process.env, env);
for (const key of [
  "FIRESTORE_EMULATOR_HOST",
  "FIREBASE_AUTH_EMULATOR_HOST",
  "FIREBASE_STORAGE_EMULATOR_HOST",
  "STORAGE_EMULATOR_HOST",
])
  delete process.env[key];
const app = initializeApp(
  { projectId: expected, credential: applicationDefault() },
  "cloud-readonly-verification",
);
console.log(
  `Read-only cloud verification: ${expected}. No documents, users, claims or objects are created.`,
);
try {
  const token = (await app.options.credential.getAccessToken()).access_token;
  const get = async (label, url, inspect) => {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        console.error(`${label}: unverified (HTTP ${response.status})`);
        process.exitCode = 1;
        return;
      }
      const data = await response.json();
      const result = inspect(data);
      console.log(`${label}: ${result}`);
      if (
        result.includes("MISMATCH") ||
        result.includes("DISABLED") ||
        result.includes("MISSING")
      )
        process.exitCode = 1;
    } catch {
      console.error(`${label}: verification request failed`);
      process.exitCode = 1;
    }
  };
  await get(
    "Project",
    `https://firebase.googleapis.com/v1beta1/projects/${expected}`,
    (d) =>
      d.projectId === expected &&
      String(d.projectNumber) === env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
        ? "ID and project number match"
        : "MISMATCH",
  );
  await get(
    "Web app",
    `https://firebase.googleapis.com/v1beta1/projects/${expected}/webApps/${encodeURIComponent(env.NEXT_PUBLIC_FIREBASE_APP_ID)}/config`,
    (d) =>
      d.projectId === expected &&
      d.appId === env.NEXT_PUBLIC_FIREBASE_APP_ID &&
      d.apiKey === env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      d.storageBucket === env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
        ? "supplied configuration matches"
        : "MISMATCH",
  );
  await get(
    "Firestore",
    `https://firestore.googleapis.com/v1/projects/${expected}/databases/(default)`,
    (d) =>
      d.locationId === "africa-south1"
        ? `africa-south1; type ${d.type}; edition ${d.databaseEdition || "not reported"}`
        : "MISMATCH: expected africa-south1",
  );
  await get(
    "Storage bucket",
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)}?fields=name,location,projectNumber`,
    (d) =>
      d.name === env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET &&
      String(d.projectNumber) === env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
        ? `bucket and project match; location ${d.location}`
        : "MISMATCH",
  );
  await get(
    "Email/password",
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${expected}/config`,
    (d) =>
      d.signIn?.email?.enabled && d.signIn.email.passwordRequired
        ? ["localhost", "127.0.0.1"].every((host) =>
            d.authorizedDomains?.includes(host),
          )
          ? "enabled; both local Auth domains are allowed"
          : "enabled; MISSING localhost and/or 127.0.0.1 in authorised domains"
        : "DISABLED or not configured",
  );
  await get(
    "Google provider",
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${expected}/defaultSupportedIdpConfigs/google.com`,
    (d) => (d.enabled ? "enabled" : "DISABLED"),
  );
} catch {
  console.error(
    "Server ADC unavailable. Configure an authorised existing service account or server ADC first; no credential contents are printed.",
  );
  process.exitCode = 1;
} finally {
  await deleteApp(app);
}
