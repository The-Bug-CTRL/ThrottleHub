// Read-only infrastructure metadata inspection. Never reads user documents/object bytes.
import fs from "node:fs/promises";
import {
  initializeApp,
  applicationDefault,
  deleteApp,
} from "firebase-admin/app";
import { environment } from "./runtime.mjs";
const env = environment(),
  project = "throttlehub-9d6b9",
  bucket = project + ".firebasestorage.app";
if (
  env.NEXT_PUBLIC_FIREBASE_MODE !== "development" ||
  [
    env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    env.NEXT_PUBLIC_FIREBASE_DEV_PROJECT_ID,
    env.GCLOUD_PROJECT,
  ].some((x) => x !== project) ||
  env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET !== bucket
)
  throw Error("Refusing mismatched cloud configuration");
const app = initializeApp(
  { projectId: project, credential: applicationDefault() },
  "readiness-metadata",
);
const result = {
  project,
  bucket,
  checkedAt: new Date().toISOString(),
  checks: {},
};
try {
  const token = (await app.options.credential.getAccessToken()).access_token;
  async function get(key, url) {
    const response = await fetch(url, {
      headers: { Authorization: "Bearer " + token },
    });
    if (!response.ok) {
      result.checks[key] = { status: response.status, verified: false };
      return null;
    }
    const data = await response.json();
    result.checks[key] = { status: 200, verified: true };
    return data;
  }
  const metadata = await get(
    "bucket",
    `https://storage.googleapis.com/storage/v1/b/${bucket}?fields=name,location,projectNumber,cors,iamConfiguration,softDeletePolicy`,
  );
  if (metadata) result.checks.bucket.metadata = metadata;
  const iam = await get(
    "bucketIam",
    `https://storage.googleapis.com/storage/v1/b/${bucket}/iam`,
  );
  if (iam)
    result.checks.bucketIam = {
      ...result.checks.bucketIam,
      roles: (iam.bindings || []).map((x) => ({
        role: x.role,
        members: x.members?.length || 0,
        publicPrincipal: (x.members || []).some((m) =>
          ["allUsers", "allAuthenticatedUsers"].includes(m),
        ),
        conditional: !!x.condition,
      })),
      scope:
        "Bucket bindings only; inherited project IAM and object ACLs are not certified.",
    };
  const hosting = await get(
    "appHosting",
    `https://firebaseapphosting.googleapis.com/v1/projects/${project}/locations/-/backends`,
  );
  if (hosting) {
    result.checks.appHosting.backends = hosting.backends || [];
    result.checks.appHosting.complete = !hosting.nextPageToken;
  }
  if (hosting)
    for (const backend of hosting.backends || []) {
      for (const resource of backend.managedResources || []) {
        const name = resource.runService?.service;
        if (
          name &&
          /^projects\/(throttlehub-9d6b9|233220150802)\/locations\/[a-z0-9-]+\/services\/[a-zA-Z0-9_-]+$/.test(
            name,
          )
        ) {
          const service = await get(
            "runtime:" + name,
            "https://run.googleapis.com/v2/" + name,
          );
          if (service)
            result.checks["runtime:" + name].configuration = {
              uri: service.uri,
              serviceAccount: service.template?.serviceAccount,
              timeout: service.template?.timeout,
              scaling: service.template?.scaling,
              containers: service.template?.containers?.map((c) => ({
                image: c.image,
                resources: c.resources,
              })),
            };
        }
      }
    }
  await fs.mkdir(".tools/cloud-readiness", { recursive: true });
  await fs.writeFile(
    ".tools/cloud-readiness/latest.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await deleteApp(app);
}
