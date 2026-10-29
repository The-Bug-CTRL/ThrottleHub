import { it, expect, vi, beforeEach } from "vitest";
const m = vi.hoisted(() => ({
  verify: vi.fn(),
  mutate: vi.fn(),
  check: vi.fn(),
  quota: vi.fn(),
}));
vi.mock("../src/lib/server", () => ({
  adminDb: () => ({ doc: () => ({ create: async () => {} }) }),
}));
vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken: m.verify }),
}));
vi.mock("firebase-admin/app-check", () => ({
  getAppCheck: () => ({ verifyToken: m.check }),
}));
vi.mock("../src/lib/support-service", async () => ({
  ...(await vi.importActual("../src/lib/support-service")),
  supportMutation: m.mutate,
  supportQuota: m.quota,
}));
import { POST } from "../src/app/api/support/route";
beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SUPPORT_GUEST_ENABLED;
  m.verify.mockResolvedValue({ uid: "trusted", admin: false });
  m.mutate.mockResolvedValue({ id: "TH-123" });
});
const request = (
  url = "http://localhost/api/support",
  headers = {},
  body = '{"action":"create"}',
) => new Request(url, { method: "POST", headers, body });
it("requires revocation-checked Auth and derives uid/role from verified claims", async () => {
  expect((await POST(request())).status).toBe(401);
  expect(
    (await POST(request(undefined, { authorization: "Bearer token" }))).status,
  ).toBe(200);
  expect(m.verify).toHaveBeenCalledWith("token", true);
  expect(m.mutate.mock.calls[0][1]).toEqual({ uid: "trusted", admin: false });
});
it("fails closed for guest creation without configuration, attestation or on token replay", async () => {
  const url = "http://localhost/api/support?guest=create";
  expect((await POST(request(url))).status).toBe(503);
  process.env.SUPPORT_GUEST_ENABLED = "true";
  m.check.mockRejectedValueOnce(Error("bad"));
  expect((await POST(request(url))).status).toBe(403);
  m.check.mockResolvedValueOnce({ alreadyConsumed: true });
  expect((await POST(request(url))).status).toBe(403);
  m.check.mockResolvedValueOnce({ alreadyConsumed: false });
  const response = await POST(request(url));
  expect(response.status).toBe(200);
  expect((await response.json()).credential).toMatch(/^[a-f0-9]{64}$/);
  expect(m.mutate.mock.calls[0][1].uid).toMatch(/^guest-[a-f0-9]{64}$/);
  expect(m.quota).toHaveBeenCalledWith(expect.anything(), "guest-global", 20);
});
it("caps bodies and returns no internal error details", async () => {
  expect(
    (
      await POST(
        request(
          undefined,
          { authorization: "Bearer token" },
          "x".repeat(10001),
        ),
      )
    ).status,
  ).toBe(413);
  m.mutate.mockRejectedValueOnce(Error("secret database path"));
  const response = await POST(
    request(undefined, { authorization: "Bearer token" }),
  );
  expect(JSON.stringify(await response.json())).not.toContain("secret");
});
it("distinguishes revoked customer sessions from unavailable Admin credentials", async () => {
  m.verify.mockRejectedValueOnce({ code: "auth/id-token-revoked" });
  expect(
    (await POST(request(undefined, { authorization: "Bearer token" }))).status,
  ).toBe(401);
  m.verify.mockRejectedValueOnce({
    code: "app/invalid-credential",
    message: "Could not load default credentials SECRET",
  });
  const response = await POST(
    request(undefined, { authorization: "Bearer token" }),
  );
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain("SECRET");
});
