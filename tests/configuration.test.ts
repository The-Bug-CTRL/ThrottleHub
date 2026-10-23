import { afterEach, it, expect, vi } from "vitest";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
it("reports missing Firebase configuration without a content fallback", async () => {
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_MODE", "");
  const c = await import("../src/lib/firebase-settings");
  expect(c.configurationError).toContain("configuration is missing");
});
it("refuses a cloud ID in emulator mode", async () => {
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_MODE", "emulator");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "some-cloud-project");
  const c = await import("../src/lib/firebase-settings");
  expect(c.configurationError).toContain("demo-");
});
it("requires explicit non-production development project confirmation", async () => {
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_MODE", "development");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "development-project");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "test-key");
  vi.stubEnv(
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "development-project.firebaseapp.com",
  );
  vi.stubEnv(
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "development-project.appspot.com",
  );
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_DEV_PROJECT_ID", "different-project");
  const c = await import("../src/lib/firebase-settings");
  expect(c.configurationError).toContain("safeguard");
});

it("accepts complete confirmed cloud configuration and keeps supplied optional Web IDs", async () => {
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_MODE", "development");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "throttlehub-9d6b9");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_DEV_PROJECT_ID", "throttlehub-9d6b9");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "test-web-key");
  vi.stubEnv(
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "throttlehub-9d6b9.firebaseapp.com",
  );
  vi.stubEnv(
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "throttlehub-9d6b9.firebasestorage.app",
  );
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_APP_ID", "test-app-id");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "123");
  const config = await import("../src/lib/firebase-settings");
  expect(config.configurationError).toBe("");
  expect(config.firebaseConfig.appId).toBe("test-app-id");
  expect(config.firebaseConfig.messagingSenderId).toBe("123");
});
