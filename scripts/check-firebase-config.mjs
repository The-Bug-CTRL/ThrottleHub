import fs from "node:fs";
import { parseEnv } from "node:util";
import { root, environment } from "./runtime.mjs";
import path from "node:path";
const expected = "throttlehub-9d6b9",
  file = path.join(root, ".env.local");
const values = fs.existsSync(file)
  ? parseEnv(fs.readFileSync(file, "utf8"))
  : {};
const rc = JSON.parse(fs.readFileSync(path.join(root, ".firebaserc"), "utf8"));
const required = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
];
const problems = [];
if (values.NEXT_PUBLIC_FIREBASE_MODE !== "development")
  problems.push(".env.local must use development mode for real Firebase.");
for (const key of [
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_DEV_PROJECT_ID",
  "GCLOUD_PROJECT",
])
  if (values[key] !== expected)
    problems.push(`${key} does not match ${expected}.`);
for (const key of required)
  if (!values[key]) problems.push(`${key} is missing.`);
for (const key of [
  "FIRESTORE_EMULATOR_HOST",
  "FIREBASE_AUTH_EMULATOR_HOST",
  "FIREBASE_STORAGE_EMULATOR_HOST",
  "STORAGE_EMULATOR_HOST",
])
  if (values[key])
    problems.push(`${key} must not be present in the cloud profile.`);
if (rc.projects.cloud !== expected)
  problems.push("The cloud alias does not match the approved project.");
if (
  values.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN !== `${expected}.firebaseapp.com` ||
  values.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET !==
    `${expected}.firebasestorage.app`
)
  problems.push("The supplied Auth domain or bucket was changed.");
const env = environment();
console.log(`Cloud target: ${expected}`);
console.log(`Web configuration: ${problems.length ? "INVALID" : "complete"}`);
console.log(
  `Server credential path: ${env.GOOGLE_APPLICATION_CREDENTIALS ? "configured (not printed or validated)" : "not configured; provide service-account ADC or an authorised existing credential path"}`,
);
console.log(
  `CLI default: ${rc.projects.default}; cloud deployment must use --project ${expected}`,
);
console.log(
  "This check is local-only. It does not verify providers, IAM, billing, database location or deployed rules.",
);
if (problems.length) {
  for (const problem of problems) console.error(problem);
  process.exitCode = 1;
}
