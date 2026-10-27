import { it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), upload: vi.fn() }));
vi.mock("../src/lib/server", () => ({ adminDb: () => ({}) }));
vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken: mocks.verify }),
}));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({ bucket: () => ({}) }),
}));
vi.mock("../src/lib/photo-service", () => ({
  MAX_PHOTO_BYTES: 5 * 1024 * 1024,
  uploadListingPhoto: mocks.upload,
}));
import { POST } from "../src/app/api/listings/[id]/photos/route";
const params = { params: Promise.resolve({ id: "owned-ad" }) };
const request = (authorization = "Bearer valid", headers = {}) =>
  new Request("http://local/api/listings/owned-ad/photos", {
    method: "POST",
    headers: { authorization, ...headers },
    body: Buffer.from([0, 255, 1]),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.verify.mockResolvedValue({ uid: "verified-owner", admin: false });
  mocks.upload.mockResolvedValue({ url: "accepted", id: "accepted" });
});
it("requires a non-revoked token before reading or decoding photo uploads", async () => {
  expect((await POST(request(""), params)).status).toBe(401);
  mocks.verify.mockRejectedValue(Error("revoked"));
  expect((await POST(request(), params)).status).toBe(401);
  expect(mocks.upload).not.toHaveBeenCalled();
  expect(mocks.verify).toHaveBeenCalledWith("valid", true);
});
it("derives photo owner from the verified token and preserves binary body bytes", async () => {
  expect(
    (
      await POST(
        request("Bearer valid", { "x-user-id": "forged-admin" }),
        params,
      )
    ).status,
  ).toBe(200);
  expect(mocks.upload.mock.calls[0][2]).toBe("verified-owner");
  expect(mocks.upload.mock.calls[0][3]).toBe("owned-ad");
  expect(mocks.upload.mock.calls[0][4]).toEqual(Buffer.from([0, 255, 1]));
});
it("rejects oversized bodies before invoking trusted media work", async () => {
  expect(
    (
      await POST(
        request("Bearer valid", {
          "content-length": String(5 * 1024 * 1024 + 1),
        }),
        params,
      )
    ).status,
  ).toBe(413);
  expect(mocks.upload).not.toHaveBeenCalled();
});
