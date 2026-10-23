import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  apps: [] as { name: string; options: { projectId: string } }[],
  init: vi.fn(),
  credential: vi.fn(),
  firestore: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("firebase-admin/app", () => ({
  getApps: () => mocks.apps,
  initializeApp: mocks.init,
  applicationDefault: mocks.credential,
}));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: mocks.firestore,
  FieldPath: { documentId: () => "__name__" },
}));
beforeEach(() => {
  mocks.apps = [];
  mocks.init.mockImplementation((options) => ({ name: "[DEFAULT]", options }));
  mocks.credential.mockReturnValue({ serverOnlyCredential: true });
  mocks.firestore.mockReturnValue({ serverOnlyFirestore: true });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});
function cloud() {
  for (const key of [
    "FIRESTORE_EMULATOR_HOST",
    "FIREBASE_AUTH_EMULATOR_HOST",
    "FIREBASE_STORAGE_EMULATOR_HOST",
    "STORAGE_EMULATOR_HOST",
  ])
    vi.stubEnv(key, "");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_MODE", "development");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "throttlehub-9d6b9");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_DEV_PROJECT_ID", "throttlehub-9d6b9");
  vi.stubEnv("GCLOUD_PROJECT", "throttlehub-9d6b9");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "test-web-key");
  vi.stubEnv(
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "throttlehub-9d6b9.firebaseapp.com",
  );
  vi.stubEnv(
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "throttlehub-9d6b9.firebasestorage.app",
  );
}
describe("Firebase Admin isolation", () => {
  it("uses explicit project and server ADC without selecting a different named app", async () => {
    cloud();
    mocks.apps = [
      { name: "unrelated-named-app", options: { projectId: "other" } },
    ];
    const { adminDb } = await import("../src/lib/server");
    expect(adminDb()).toEqual({ serverOnlyFirestore: true });
    expect(mocks.init).toHaveBeenCalledWith({
      projectId: "throttlehub-9d6b9",
      credential: { serverOnlyCredential: true },
    });
  });
  it("refuses an inherited Auth emulator endpoint in cloud mode", async () => {
    cloud();
    vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", "127.0.0.1:9299");
    const { adminDb } = await import("../src/lib/server");
    expect(() => adminDb()).toThrow("emulator endpoints");
    expect(mocks.init).not.toHaveBeenCalled();
  });
  it("refuses server/browser project disagreement and stale Admin apps", async () => {
    cloud();
    vi.stubEnv("GCLOUD_PROJECT", "different-project");
    const { adminDb } = await import("../src/lib/server");
    expect(() => adminDb()).toThrow("configuration mismatch");
    vi.stubEnv("GCLOUD_PROJECT", "throttlehub-9d6b9");
    mocks.apps = [
      { name: "[DEFAULT]", options: { projectId: "different-project" } },
    ];
    expect(() => adminDb()).toThrow("Restart");
  });
  it("rejects private or unknown collections through the public helper", async () => {
    cloud();
    const { publicDocument } = await import("../src/lib/server");
    await expect(publicDocument("users", "private-id")).rejects.toThrow(
      "Unsupported public",
    );
    await expect(
      publicDocument("newsArticles", "draft-id", ["draft"]),
    ).rejects.toThrow("Unsupported public");
    expect(mocks.firestore).not.toHaveBeenCalled();
  });
});
