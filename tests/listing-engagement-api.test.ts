import { it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  record: vi.fn(),
  stats: vi.fn(),
}));
vi.mock("../src/lib/server", () => ({ adminDb: () => ({}) }));
vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken: mocks.verify }),
}));
vi.mock("../src/lib/listing-engagement", () => ({
  engagementEvents: ["view", "phone", "message"],
  recordEngagement: mocks.record,
  sellerListingStats: mocks.stats,
}));
import { POST } from "../src/app/api/listings/[id]/engagement/route";
import { GET } from "../src/app/api/listings/[id]/stats/route";
const params = { params: Promise.resolve({ id: "item" }) };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.verify.mockResolvedValue({ uid: "buyer" });
  mocks.record.mockResolvedValue({ phone: "+27821234567", recorded: true });
  mocks.stats.mockResolvedValue({ views: 1, favourites: 2 });
});
const request = (body: unknown, headers = {}) =>
  new NextRequest("http://localhost/api/listings/item/engagement", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
it("never accepts forged totals, caller identity, cross-origin requests or oversized bodies", async () => {
  expect(
    (await POST(request({ event: "view", uid: "seller", view: 999 }), params))
      .status,
  ).toBe(400);
  expect(
    (
      await POST(
        request({ event: "view" }, { origin: "https://other.test" }),
        params,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await POST(
        request({ event: "view" }, { "content-length": "1001" }),
        params,
      )
    ).status,
  ).toBe(413);
  expect(mocks.record).not.toHaveBeenCalled();
});
it("uses verified account identity, rejects revoked tokens and protects seller stat reads", async () => {
  expect(
    (
      await POST(
        request({ event: "message" }, { authorization: "Bearer real" }),
        params,
      )
    ).status,
  ).toBe(200);
  expect(mocks.record.mock.calls[0].slice(1)).toEqual([
    "item",
    "message",
    "uid:buyer",
    "buyer",
  ]);
  expect(mocks.verify).toHaveBeenCalledWith("real", true);
  expect((await GET(new Request("http://localhost"), params)).status).toBe(401);
  await GET(
    new Request("http://localhost", {
      headers: { authorization: "Bearer real" },
    }),
    params,
  );
  expect(mocks.stats.mock.calls[0].slice(1)).toEqual(["item", "buyer"]);
  mocks.verify.mockRejectedValue(Error("revoked"));
  expect(
    (
      await POST(
        request({ event: "view" }, { authorization: "Bearer real" }),
        params,
      )
    ).status,
  ).toBe(401);
});
it("gives anonymous public visitors an opaque HTTP-only cookie", async () => {
  const response = await POST(request({ event: "view" }), params);
  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  expect(response.headers.get("cache-control")).toContain("no-store");
});
