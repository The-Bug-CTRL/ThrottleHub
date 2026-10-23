import { it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  mutate: vi.fn(),
  finish: vi.fn(),
}));
vi.mock("../src/lib/server", () => ({ adminDb: () => ({}) }));
vi.mock("../src/lib/firebase-settings", () => ({ firebaseMode: "emulator" }));
vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken: mocks.verify }),
}));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({ bucket: () => ({}) }),
}));
vi.mock("../src/lib/listing-media", () => ({
  finishListingMedia: mocks.finish,
}));
vi.mock("../src/lib/listing-lifecycle", async () => ({
  ...(await vi.importActual<typeof import("../src/lib/listing-lifecycle")>(
    "../src/lib/listing-lifecycle",
  )),
  mutateListing: mocks.mutate,
}));
import { POST } from "../src/app/api/listings/[id]/route";
const params = { params: Promise.resolve({ id: "item" }) };
const request = (body: unknown, token = "valid") =>
  new NextRequest("http://localhost/api/listings/item", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.verify.mockResolvedValue({ uid: "seller" });
  mocks.mutate.mockResolvedValue({ status: "sold", slug: "motorcycle" });
  mocks.finish.mockResolvedValue(undefined);
});
it("requires a valid non-revoked Firebase token before invoking Admin writes", async () => {
  expect(
    (await POST(request({ action: "status", status: "sold" }, ""), params))
      .status,
  ).toBe(401);
  mocks.verify.mockRejectedValue(Error("revoked"));
  expect(
    (await POST(request({ action: "status", status: "sold" }), params)).status,
  ).toBe(401);
  expect(mocks.mutate).not.toHaveBeenCalled();
  expect(mocks.verify).toHaveBeenCalledWith("valid", true);
});
it("takes identity and staff claims only from the verified token", async () => {
  const response = await POST(
    request({
      action: "status",
      status: "removed",
      uid: "admin",
      admin: true,
      actor: { uid: "admin" },
    }),
    params,
  );
  expect(response.status).toBe(200);
  expect(mocks.mutate.mock.calls[0][2]).toEqual({
    uid: "seller",
    admin: false,
    moderator: false,
  });
});
it("keeps failed media cleanup retryable rather than reporting a completed deletion", async () => {
  mocks.finish.mockRejectedValue(Error("Storage offline"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const response = await POST(
      request({ action: "status", status: "removed" }),
      params,
    );
    expect(response.status).toBe(202);
    expect((await response.json()).cleanupPending).toBe(true);
  } finally {
    log.mockRestore();
  }
});
