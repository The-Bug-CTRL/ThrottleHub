import { beforeEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), action: vi.fn() }));
vi.mock("../src/lib/server", () => ({ adminDb: () => ({}) }));
vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken: mocks.verify }),
}));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({ bucket: () => ({}) }),
}));
vi.mock("../src/lib/video-service", () => ({ videoAction: mocks.action }));
import { POST } from "../src/app/api/listings/[id]/videos/route";
const params = { params: Promise.resolve({ id: "item" }) };
const request = (body: string, token = "valid") =>
  new Request("http://localhost/api/listings/item/videos", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.verify.mockResolvedValue({ uid: "real-user" });
  mocks.action.mockResolvedValue({ id: "slot" });
});
it("requires a valid nonrevoked Auth token before creating upload slots", async () => {
  expect((await POST(request("{}", ""), params)).status).toBe(401);
  mocks.verify.mockRejectedValue(Error("revoked"));
  expect((await POST(request("{}"), params)).status).toBe(401);
  expect(mocks.action).not.toHaveBeenCalled();
});
it("takes upload ownership from the verified token, not supplied account flags", async () => {
  expect(
    (
      await POST(
        request('{"action":"begin","uid":"other","admin":true}'),
        params,
      )
    ).status,
  ).toBe(200);
  expect(mocks.verify).toHaveBeenCalledWith("valid", true);
  expect(mocks.action.mock.calls[0][2]).toBe("real-user");
});
it.each(["null", "[]", "{"])(
  "rejects invalid video request %s",
  async (body) => {
    expect((await POST(request(body), params)).status).toBe(400);
    expect(mocks.action).not.toHaveBeenCalled();
  },
);
it("rejects oversized video control requests before calling the service", async () => {
  expect((await POST(request("x".repeat(2001)), params)).status).toBe(413);
  expect(mocks.action).not.toHaveBeenCalled();
});
