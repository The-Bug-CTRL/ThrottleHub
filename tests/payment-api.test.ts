import { it, expect, vi, beforeEach } from "vitest";
const m = vi.hoisted(() => ({
  verify: vi.fn(),
  initialize: vi.fn(),
  fulfil: vi.fn(),
  cancel: vi.fn(),
  context: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock("../src/lib/server", () => ({ adminDb: () => ({}) }));
vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken: m.verify, getUser: m.getUser }),
}));
vi.mock("../src/lib/payments", async () => ({
  ...(await vi.importActual("../payments-functions/src/core/catalogue")),
  ...(await vi.importActual("../payments-functions/src/core/promotions")),
  paymentContext: m.context,
  paymentEnvironment: () => "test",
  paymentsEnabled: () => true,
  paymentCallbackUrl: () => "http://localhost:3000/account/promotions",
  initializePromotion: m.initialize,
  verifyPromotion: m.fulfil,
  cancelPromotion: m.cancel,
}));
import { POST } from "../src/app/api/promotions/route";
import { GET as adminGET } from "../src/app/api/admin/payments/route";
beforeEach(() => {
  vi.clearAllMocks();
  m.verify.mockResolvedValue({ uid: "verified-seller" });
  m.getUser.mockResolvedValue({ email: "trusted@example.test" });
  m.context.mockResolvedValue({ db: {}, environment: "test", provider: {} });
  m.initialize.mockResolvedValue({
    url: "https://checkout.paystack.com/approved",
    reference: "test-reference",
    environment: "test",
  });
  m.fulfil.mockResolvedValue({ status: "pending", environment: "test" });
});
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/promotions", {
    method: "POST",
    headers: { authorization: "Bearer real-token", ...headers },
    body: JSON.stringify(body),
  });
}
it("requires verified authentication and rejects client pricing/ownership/benefits and cross-origin initialization", async () => {
  expect(
    (
      await POST(
        new Request("http://localhost:3000/api/promotions", {
          method: "POST",
          body: "{}",
        }),
      )
    ).status,
  ).toBe(401);
  for (const extra of [
    { amount: 1 },
    { uid: "other" },
    { featured: true },
    { durationDays: 999 },
    { environment: "live" },
  ])
    expect(
      (
        await POST(
          request({
            action: "initialize",
            listingId: "owned",
            sku: "bump",
            ...extra,
          }),
        )
      ).status,
    ).toBe(400);
  expect(
    (
      await POST(
        request(
          { action: "initialize", listingId: "owned", sku: "bump" },
          { origin: "https://attacker.test" },
        ),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await POST(
        request(
          { action: "initialize", listingId: "owned", sku: "bump" },
          { "content-length": "3001" },
        ),
      )
    ).status,
  ).toBe(413);
  expect(m.initialize).not.toHaveBeenCalled();
});
it("passes only the verified UID and Auth email to the trusted priced service", async () => {
  const response = await POST(
    request({ action: "initialize", listingId: "owned", sku: "featured7" }),
  );
  expect(response.status).toBe(200);
  expect(m.verify).toHaveBeenCalledWith("real-token", true);
  expect(m.getUser).toHaveBeenCalledWith("verified-seller");
  expect(m.initialize.mock.calls[0].slice(1)).toEqual([
    "verified-seller",
    "trusted@example.test",
    "owned",
    "featured7",
    "http://localhost:3000/account/promotions",
  ]);
  expect(JSON.stringify(await response.json())).not.toContain("sk_");
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it("never accepts browser success as fulfilment and denies moderator/ordinary access to payment administration", async () => {
  expect(
    (await POST(request({ action: "verify", reference: "ref", success: true })))
      .status,
  ).toBe(400);
  expect(
    (await POST(request({ action: "verify", reference: "ref" }))).status,
  ).toBe(200);
  expect(m.fulfil.mock.calls[0].slice(1)).toEqual(["ref", "verified-seller"]);
  expect(
    (
      await adminGET(
        new Request("http://localhost:3000/api/admin/payments", {
          headers: { authorization: "Bearer real-token" },
        }),
      )
    ).status,
  ).toBe(403);
  m.verify.mockResolvedValue({ uid: "moderator", moderator: true });
  expect(
    (
      await adminGET(
        new Request("http://localhost:3000/api/admin/payments", {
          headers: { authorization: "Bearer real-token" },
        }),
      )
    ).status,
  ).toBe(403);
});
it("rejects revoked sessions before contacting the payment provider", async () => {
  m.verify.mockRejectedValue(Error("revoked"));
  expect(
    (
      await POST(
        request({ action: "initialize", listingId: "owned", sku: "bump" }),
      )
    ).status,
  ).toBe(401);
  expect(m.context).not.toHaveBeenCalled();
});
