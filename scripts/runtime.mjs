import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
export const root = path.resolve(import.meta.dirname, "..");
export function environment(file = ".env.local") {
  const env = {
    ...process.env,
    ...(fs.existsSync(path.join(root, file))
      ? parseEnv(fs.readFileSync(path.join(root, file), "utf8"))
      : {}),
  };
  // Firebase CLI treats any DEBUG value as verbose; never dump inherited environment.
  delete env.DEBUG;
  const javaRoot = path.join(root, ".tools", "java");
  const java = fs.existsSync(javaRoot)
    ? fs.readdirSync(javaRoot).find((d) => d.startsWith("jdk-"))
    : undefined;
  env.PATH = [
    path.dirname(process.execPath),
    ...(java ? [path.join(javaRoot, java, "bin")] : []),
    env.PATH,
  ].join(path.delimiter);
  env.XDG_CONFIG_HOME = path.join(root, ".tools", "config");
  env.FIREBASE_EMULATORS_PATH = path.join(root, ".tools", "emulators");
  if (env.NEXT_PUBLIC_FIREBASE_MODE === "emulator") {
    if (!env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.startsWith("demo-"))
      throw new Error("Emulator mode refuses non-demo project IDs.");
    env.NEXT_PUBLIC_FIREBASE_APP_ID = "";
    env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "";
    delete env.GOOGLE_APPLICATION_CREDENTIALS;
    env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
    env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
    env.GCLOUD_PROJECT = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
  } else {
    delete env.FIRESTORE_EMULATOR_HOST;
    delete env.FIREBASE_AUTH_EMULATOR_HOST;
    delete env.FIREBASE_STORAGE_EMULATOR_HOST;
    delete env.STORAGE_EMULATOR_HOST;
  }
  return env;
}
