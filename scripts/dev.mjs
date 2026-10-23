import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { root, environment } from "./runtime.mjs";
if (!fs.existsSync(path.join(root, ".env.local")))
  fs.copyFileSync(
    path.join(root, ".env.example"),
    path.join(root, ".env.local"),
  );
const profile = process.argv.includes("--emulator")
  ? fs.existsSync(path.join(root, ".env.emulator.local"))
    ? ".env.emulator.local"
    : ".env.emulator.example"
  : ".env.local";
const env = environment(profile),
  children = [];
function start(script, args) {
  const child = spawn(process.execPath, [script, ...args], {
    cwd: root,
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  children.push(child);
  return child;
}
function stop() {
  for (const c of children)
    if (c.exitCode === null) {
      if (process.platform === "win32")
        spawnSync("taskkill", ["/PID", String(c.pid), "/T", "/F"], {
          stdio: "ignore",
          windowsHide: true,
        });
      else c.kill("SIGTERM");
    }
}
process.on("SIGINT", () => {
  stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stop();
  process.exit(0);
});
process.on("exit", stop);
async function occupied(port) {
  return new Promise((resolve) => {
    const s = net.connect(port, "127.0.0.1");
    s.once("connect", () => {
      s.destroy();
      resolve(true);
    });
    s.once("error", () => resolve(false));
  });
}
if (env.NEXT_PUBLIC_FIREBASE_MODE === "development") {
  if (
    env.GCLOUD_PROJECT !== env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    env.NEXT_PUBLIC_FIREBASE_DEV_PROJECT_ID !==
      env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.startsWith("demo-")
  )
    throw new Error("Cloud project confirmation does not match .env.local.");
  console.log(
    `\nThrottleHub: REAL Firebase project ${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}. No emulators will be started.\n`,
  );
}
if (env.NEXT_PUBLIC_FIREBASE_MODE === "emulator") {
  for (const port of [8080, 9099, 9199, 4000])
    if (await occupied(port))
      throw new Error(
        `Port ${port} is already in use. Stop the existing local emulator process, or run npm run dev:web to use services you manage yourself.`,
      );
  const emulator = start("node_modules/firebase-tools/lib/bin/firebase.js", [
    "emulators:start",
    "--project",
    env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  ]);
  let ready = false;
  for (let n = 0; n < 120; n++) {
    if (emulator.exitCode !== null)
      throw new Error("Firebase emulators exited before startup completed.");
    try {
      const r = await fetch("http://127.0.0.1:4400/emulators");
      const data = await r.json();
      if (data.auth && data.firestore && data.storage) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready)
    throw new Error(
      "Firebase emulators were not ready within 60 seconds. Check Java and port availability.",
    );
  console.log(
    "\nThrottleHub: local Firebase ready. No accounts or content were created.\n",
  );
}
const web = start("node_modules/next/dist/bin/next", [
  "dev",
  "--hostname",
  "127.0.0.1",
]);
web.on("exit", (code) => {
  stop();
  process.exit(code || 0);
});
