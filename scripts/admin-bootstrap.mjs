import fs from "node:fs";
import path from "node:path";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { environment, root } from "./runtime.mjs";
const env = environment(
  fs.existsSync(path.join(root, ".env.emulator.local"))
    ? ".env.emulator.local"
    : ".env.emulator.example",
);
if (
  env.NEXT_PUBLIC_FIREBASE_MODE !== "emulator" ||
  env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== "demo-throttlehub"
)
  throw new Error(
    "This bootstrap is local-only. Cloud role grants require a separate explicitly authorised operation.",
  );
const uid = process.argv[2];
if (!uid || uid.length > 128)
  throw new Error(
    "Usage: npm run admin:bootstrap -- <existing-local-user-uid>",
  );
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
initializeApp({ projectId: "demo-throttlehub" });
const auth = getAuth();
const user = await auth.getUser(uid);
await auth.setCustomUserClaims(uid, { ...user.customClaims, admin: true });
console.log(
  "Administrator claim granted to the specified existing local UID. Sign out and sign in again. No account/password was created.",
);
