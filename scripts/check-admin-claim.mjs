// Read-only operator check. Never sets claims or prints identity tokens/credentials.
import {
  initializeApp,
  applicationDefault,
  deleteApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { environment } from "./runtime.mjs";
const env = environment(),
  uid = process.argv[process.argv.indexOf("--uid") + 1];
if (
  !process.argv.includes("--uid") ||
  !/^[a-zA-Z0-9_-]{1,128}$/.test(uid || "")
)
  throw Error("Pass --uid with the exact Firebase Auth UID.");
if (
  env.NEXT_PUBLIC_FIREBASE_MODE !== "development" ||
  env.GCLOUD_PROJECT !== "throttlehub-9d6b9" ||
  env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== "throttlehub-9d6b9"
)
  throw Error("Expected confirmed cloud project throttlehub-9d6b9.");
Object.assign(process.env, env);
if (process.env.FIREBASE_AUTH_EMULATOR_HOST)
  throw Error("Remove emulator configuration before a cloud claim check.");
const app = initializeApp({
  projectId: "throttlehub-9d6b9",
  credential: applicationDefault(),
});
try {
  const user = await getAuth(app).getUser(uid);
  console.log(
    JSON.stringify({
      project: "throttlehub-9d6b9",
      admin: user.customClaims?.admin === true,
      moderator: user.customClaims?.moderator === true,
      disabled: user.disabled,
    }),
  );
} catch {
  console.error(
    "Read-only claim verification unavailable. Check approved ADC, Auth read permissions and the supplied UID. No account changed.",
  );
  process.exitCode = 1;
} finally {
  await deleteApp(app);
}
