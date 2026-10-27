// Read-only configuration backup. No customer documents, users or object bytes are read.
import fs from "node:fs/promises";
import path from "node:path";
import {
  initializeApp,
  applicationDefault,
  deleteApp,
} from "firebase-admin/app";
import { environment, root } from "./runtime.mjs";
const env = environment(),
  project = "throttlehub-9d6b9";
if (
  env.NEXT_PUBLIC_FIREBASE_MODE !== "development" ||
  [
    env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    env.NEXT_PUBLIC_FIREBASE_DEV_PROJECT_ID,
    env.GCLOUD_PROJECT,
  ].some((v) => v !== project) ||
  env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET !== `${project}.firebasestorage.app`
)
  throw Error(
    "Refusing backup: the confirmed ThrottleHub cloud project/bucket must match.",
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
  { projectId: project, credential: applicationDefault() },
  "readonly-security-backup",
);
try {
  const token = (await app.options.credential.getAccessToken()).access_token;
  const get = async (url, allowMissing = false) => {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
    });
    if (response.status === 404 && allowMissing) return null;
    if (!response.ok)
      throw Error(
        `Configuration read failed (HTTP ${response.status}). Backup is incomplete; do not deploy.`,
      );
    return response.json();
  };
  const destination = path.join(
    root,
    ".tools",
    "cloud-security-backup",
    new Date().toISOString().replaceAll(":", "-"),
  );
  await fs.mkdir(destination, { recursive: true });
  const save = (name, value) =>
    fs.writeFile(path.join(destination, name), JSON.stringify(value, null, 2));
  let nextPageToken,
    releases = [];
  do {
    const result = await get(
      `https://firebaserules.googleapis.com/v1/projects/${project}/releases${nextPageToken ? `?pageToken=${encodeURIComponent(nextPageToken)}` : ""}`,
    );
    releases.push(...(result.releases || []));
    nextPageToken = result.nextPageToken;
  } while (nextPageToken);
  await save("releases.json", releases);
  for (const [i, release] of releases.entries()) {
    if (!release.rulesetName?.startsWith(`projects/${project}/rulesets/`))
      throw Error("Unexpected ruleset project; refusing read.");
    const ruleset = await get(
      `https://firebaserules.googleapis.com/v1/${release.rulesetName}`,
    );
    await save(`active-ruleset-${i}.json`, { release, ruleset });
    for (const [j, file] of (ruleset.source?.files || []).entries())
      await fs.writeFile(
        path.join(destination, `active-ruleset-${i}-source-${j}.rules`),
        file.content || "",
      );
  }
  let indexes = [];
  nextPageToken = undefined;
  do {
    const result = await get(
      `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/collectionGroups/-/indexes${nextPageToken ? `?pageToken=${encodeURIComponent(nextPageToken)}` : ""}`,
    );
    indexes.push(...(result.indexes || []));
    nextPageToken = result.nextPageToken;
  } while (nextPageToken);
  await save("firestore-indexes-api.json", indexes);
  const localConfig = JSON.parse(
    await fs.readFile(path.join(root, "firestore.indexes.json"), "utf8"),
  );
  const fields = [];
  for (const field of localConfig.fieldOverrides || []) {
    fields.push({
      collectionGroup: field.collectionGroup,
      fieldPath: field.fieldPath,
      configuration: await get(
        `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/collectionGroups/${encodeURIComponent(field.collectionGroup)}/fields/${encodeURIComponent(field.fieldPath)}`,
        true,
      ),
    });
  }
  await save("firestore-field-configs-api.json", fields);
  const bucket = await get(
    `https://storage.googleapis.com/storage/v1/b/${project}.firebasestorage.app`,
  );
  if (
    String(bucket.projectNumber) !==
    env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  )
    throw Error("Bucket project mismatch. Do not deploy.");
  await save("bucket-metadata.json", bucket);
  await save("COMPLETE.json", {
    project,
    bucket: bucket.name,
    exportedAt: new Date().toISOString(),
    releases: releases.length,
    indexes: indexes.length,
  });
  console.log(
    `Read-only configuration backup complete: ${destination}. No deployment performed.`,
  );
} catch (error) {
  // Never print credential objects, access tokens or untrusted response bodies.
  console.error(
    error instanceof Error &&
      /Configuration read|Unexpected ruleset|Bucket project/.test(error.message)
      ? error.message
      : "Security backup unavailable. Authorised ADC and read permissions are required; no deployment performed.",
  );
  process.exitCode = 1;
} finally {
  await deleteApp(app);
}
