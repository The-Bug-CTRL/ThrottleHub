import { it, expect, vi, beforeEach } from "vitest";
import { ListingError } from "../src/lib/listing-lifecycle";
const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  ensure: vi.fn(),
  edit: vi.fn(),
  feed: vi.fn(),
}));
vi.mock("../src/lib/server", () => ({ adminDb: () => ({}) }));
vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken: mocks.verify }),
}));
vi.mock("../src/lib/profile-service", () => ({
  ensureProfile: mocks.ensure,
  editProfile: mocks.edit,
}));
vi.mock("../src/lib/imported-content-server", () => ({
  importedFeed: mocks.feed,
}));
import { GET, POST, PATCH } from "../src/app/api/account/profile/route";
import { GET as feedGET } from "../src/app/api/content/[kind]/route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.verify.mockResolvedValue({ uid: "verified-owner" });
  mocks.ensure.mockResolvedValue({
    needsSetup: false,
    profile: { displayName: "Rider" },
  });
  mocks.edit.mockResolvedValue({ profile: { displayName: "Updated" } });
  mocks.feed.mockResolvedValue({ items: [], categories: [], cursor: null });
});
function req(
  input: unknown = {},
  headers: Record<string, string> = {},
  method = "POST",
) {
  return new Request("http://localhost:3000/api/account/profile", {
    method,
    headers: { authorization: "Bearer token", ...headers },
    ...(method === "GET" ? {} : { body: JSON.stringify(input) }),
  });
}
it("requires a verified, non-revoked identity and derives the UID exclusively from its token", async () => {
  expect(
    (await GET(new Request("http://localhost:3000/api/account/profile")))
      .status,
  ).toBe(401);
  expect((await POST(req({ accountType: "personal" }))).status).toBe(200);
  expect(mocks.verify).toHaveBeenCalledWith("token", true);
  expect(mocks.ensure.mock.calls[0][1]).toBe("verified-owner");
  expect((await PATCH(req({}, {}, "PATCH"))).status).toBe(200);
  expect(mocks.edit.mock.calls[0][1]).toBe("verified-owner");
  mocks.verify.mockRejectedValue(Error("revoked"));
  expect((await GET(req({}, {}, "GET"))).status).toBe(401);
});
it("returns clear account errors; rejects cross-origin, malformed and oversized profile requests", async () => {
  expect((await POST(req({}, { origin: "https://other.test" }))).status).toBe(
    403,
  );
  expect((await POST(req({}, { "content-length": "12001" }))).status).toBe(413);
  expect(mocks.ensure).not.toHaveBeenCalled();
  mocks.ensure.mockRejectedValue(
    new ListingError("Invalid account identity.", 403),
  );
  const response = await POST(req({ accountType: "personal" }));
  expect(response.status).toBe(403);
  expect((await response.json()).error).toContain("Invalid account identity");
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it("content routes support only approved public feeds with bounded validated filters and honest outage responses", async () => {
  const params = { params: Promise.resolve({ kind: "news" }) };
  expect(
    (
      await feedGET(
        new Request("http://localhost/api/content/news?search=two+stroke"),
        params,
      )
    ).status,
  ).toBe(200);
  expect(mocks.feed.mock.calls[0][1]).toBe("news");
  expect(mocks.feed.mock.calls[0][2].search).toBe("two stroke");
  expect(
    (
      await feedGET(
        new Request("http://localhost/api/content/news?limit=99999"),
        params,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await feedGET(
        new Request("http://localhost/api/content/contentSourceHealth"),
        { params: Promise.resolve({ kind: "contentSourceHealth" }) },
      )
    ).status,
  ).toBe(404);
  mocks.feed.mockRejectedValue(Error("unavailable"));
  expect(
    (await feedGET(new Request("http://localhost/api/content/news"), params))
      .status,
  ).toBe(503);
});
it("routes video category filters to the existing server feed without exposing source health", async () => {
  const response = await feedGET(
    new Request("http://localhost/api/content/videos?category=Hard+Enduro"),
    { params: Promise.resolve({ kind: "videos" }) },
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(mocks.feed).toHaveBeenCalledWith({}, "videos", {
    category: "Hard Enduro",
    past: false,
  });
});
