import { spawn } from "node:child_process";
import { root, environment } from "./runtime.mjs";
const env = environment(".env.emulator.example");
// Tests never inherit the real project configuration or server credential path.
env.NEXT_PUBLIC_FIREBASE_MODE = "emulator";
env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-throttlehub-tests";
env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "demo-throttlehub-tests.firebaseapp.com";
env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "demo-throttlehub-tests.appspot.com";
delete env.NEXT_PUBLIC_FIREBASE_DEV_PROJECT_ID;
env.NEXT_PUBLIC_FIREBASE_APP_ID = "";
env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "";
delete env.GOOGLE_APPLICATION_CREDENTIALS;
env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8180";
env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9299";
env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9298";
env.GCLOUD_PROJECT = "demo-throttlehub-tests";
env.RUN_FIREBASE_TESTS = "true";
const child = spawn(
  process.execPath,
  [
    "node_modules/firebase-tools/lib/bin/firebase.js",
    "emulators:exec",
    "--config",
    "firebase.test.json",
    "--project",
    "demo-throttlehub-tests",
    "--only",
    "auth,firestore,storage",
    "node node_modules/vitest/vitest.mjs run",
  ],
  { cwd: root, env, stdio: "inherit", windowsHide: true },
);
child.on("exit", (code) => process.exit(code || 0));
