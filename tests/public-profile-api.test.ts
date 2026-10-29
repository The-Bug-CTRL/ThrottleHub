import { it, expect, vi } from "vitest";
const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server", () => ({ adminDb: () => ({ doc: () => ({ get }) }) }));
import { GET } from "../src/app/api/profiles/[id]/route";
const request = (id: string) => GET(new Request("http://localhost/api/profiles/" + id), { params: Promise.resolve({ id }) });
it("serves legacy public identity while excluding unconsented and unexpected private fields", async () => {
  for (const accountType of ["personal", "business"]) {
    get.mockResolvedValue({ exists: true, data: () => ({ accountType, displayName: "Rider", city: "Cape Town", contactPhone: "private", email: "private", business: { name: "Shop", phone: "private", email: "private", secret: "private" } }) });
    const response = await request("legacy");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.profile.displayName).toBe("Rider");
    expect(body.profile.city).toBe("Cape Town");
    expect(JSON.stringify(body)).not.toContain("private");
    expect(response.headers.get("cache-control")).toBe("no-store");
  }
});
it("rejects invalid IDs, returns absent profiles and hides backend failures", async () => {
  expect((await request("bad/id")).status).toBe(400);
  get.mockResolvedValue({ exists: false });
  expect(await (await request("missing")).json()).toEqual({ profile: null });
  get.mockRejectedValue(Error("secret backend credentials"));
  const response = await request("unavailable");
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("secret");
});
