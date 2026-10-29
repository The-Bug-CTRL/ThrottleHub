import { it, expect, vi, beforeEach } from "vitest";
const m = vi.hoisted(() => ({
  verify: vi.fn(),
  publish: vi.fn(),
  begin: vi.fn(),
  read: vi.fn(),
  metadata: vi.fn(),
}));
vi.mock("@/lib/server", () => ({ adminDb: () => ({}) }));
vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken: m.verify }),
}));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: () => ({ file: () => ({ getMetadata: m.metadata }) }),
  }),
}));
vi.mock("../src/lib/forum-media-service", async () => ({
  ...(await vi.importActual("../src/lib/forum-media-service")),
  publishForumPost: m.publish,
  beginForumMedia: m.begin,
  readableForumMedia: m.read,
}));
import { POST } from "../src/app/api/forum/posts/route";
import { GET, POST as begin } from "../src/app/api/forum/media/route";
beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET =
    "demo-throttlehub-tests.appspot.com";
  m.verify.mockResolvedValue({ uid: "verified" });
  m.publish.mockResolvedValue({ id: "thread" });
  m.begin.mockResolvedValue({ id: "slot" });
});
const request = (body = "{}", headers = {}) =>
  new Request("http://localhost/api/forum/posts", {
    method: "POST",
    headers,
    body,
  });
it("requires verified identity, rejects foreign origins and bounds publication input", async () => {
  expect((await POST(request())).status).toBe(401);
  expect(
    (
      await POST(
        request("{}", {
          authorization: "Bearer token",
          origin: "https://evil.test",
        }),
      )
    ).status,
  ).toBe(403);
  expect(
    (await POST(request("{}", { authorization: "Bearer token" }))).status,
  ).toBe(200);
  expect(m.verify).toHaveBeenCalledWith("token", true);
  expect(m.publish.mock.calls[0][2]).toBe("verified");
  expect(
    (await POST(request("x".repeat(20001), { authorization: "Bearer token" })))
      .status,
  ).toBe(413);
  expect((await begin(request())).status).toBe(401);
});
it("hides internal failures and rejects malformed or out-of-bounds media ranges", async () => {
  m.publish.mockRejectedValue(Error("private credentials"));
  const failed = await POST(request("{}", { authorization: "Bearer token" }));
  expect(failed.status).toBe(503);
  expect(await failed.text()).not.toContain("credentials");
  m.read.mockResolvedValue({
    path: "forum-media/a/b.mp4",
    generation: "7",
    size: 10,
    type: "video/mp4",
  });
  m.metadata.mockResolvedValue([
    { generation: "7", size: 10, contentType: "video/mp4" },
  ]);
  for (const range of ["bytes=99-", "bytes=3-1", "bytes=0-1,3-4", "wrong"])
    expect(
      (
        await GET(
          new Request("http://localhost/api/forum/media?id=valid", {
            headers: { range },
          }),
        )
      ).status,
    ).toBe(416);
});
