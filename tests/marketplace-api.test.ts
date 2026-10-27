import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { z } from "zod";
const mocks = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("../src/lib/server", () => ({ adminDb: () => ({}) }));
vi.mock("../src/lib/marketplace-search", () => ({
  queryMarketplace: mocks.search,
}));
import { POST } from "../src/app/api/marketplace/search/route";
const request = (body: string) =>
  new Request("http://localhost/api/marketplace/search", {
    method: "POST",
    body,
  });
beforeEach(() => {
  mocks.search.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
it.each(["{", "null", "[]"])(
  "rejects malformed search body %s before Admin queries",
  async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.search).not.toHaveBeenCalled();
  },
);
it("rejects an oversized body without content-length", async () => {
  expect((await POST(request("x".repeat(12001)))).status).toBe(413);
  expect(mocks.search).not.toHaveBeenCalled();
});
it("returns schema errors as client errors", async () => {
  const result = z.object({ name: z.string() }).safeParse({});
  if (!result.success) mocks.search.mockRejectedValue(result.error);
  expect((await POST(request('{"filters":{}}'))).status).toBe(400);
});
it("reports missing indexes and backend outages as unavailable without leaking internal details", async () => {
  for (const message of [
    "FAILED_PRECONDITION: index missing",
    "sensitive backend details",
  ]) {
    mocks.search.mockRejectedValue(Error(message));
    const response = await POST(request('{"filters":{}}'));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("sensitive backend details");
  }
});
it("returns a successful bounded search response without caching", async () => {
  mocks.search.mockResolvedValue({ items: [], more: false });
  const response = await POST(request('{"filters":{}}'));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
});
