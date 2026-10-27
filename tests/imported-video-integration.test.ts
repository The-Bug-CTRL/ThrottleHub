import { beforeAll, afterAll, it, expect } from "vitest";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { importedFeed } from "../src/lib/imported-content-server";
import { testProject } from "./fixtures";
let app: ReturnType<typeof initializeApp>, db: ReturnType<typeof getFirestore>;
beforeAll(() => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8180")
    throw Error("Isolated emulator required");
  app = initializeApp({ projectId: testProject }, "imported-video-tests");
  db = getFirestore(app);
});
afterAll(async () => {
  await deleteApp(app);
});
it("queries genuine SDK video records newest first, with visibility checks, category filters, pagination and empty results", async () => {
  const videoId = "aBcdEF_12-3";
  for (let i = 0; i < 17; i++)
    await db
      .doc(`contentVideos/video-test-${String(i).padStart(2, "0")}`)
      .set({
        kind: "youtube",
        status: i === 16 ? "draft" : "published",
        manuallyHidden: i === 15,
        videoId: i === 14 ? "invalid" : videoId,
        title: `Race clip ${i}`,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        publishedAt: new Date(Date.UTC(2026, 9, i + 1)).toISOString(),
        category: i % 2 ? "Motocross" : "Hard Enduro",
        channelName: "Official channel",
        editorLocked: false,
        internal: "never public",
      });
  const first = await importedFeed(db, "videos");
  expect(first.items).toHaveLength(12);
  expect(first.items[0].id).toBe("video-test-13");
  expect(first.cursor).toBeTruthy();
  expect(JSON.stringify(first)).not.toContain("never public");
  const second = await importedFeed(db, "videos", { cursor: first.cursor! });
  expect(second.items).toHaveLength(2);
  expect(second.cursor).toBeNull();
  expect(second.items.map((x) => x.id)).toEqual([
    "video-test-01",
    "video-test-00",
  ]);
  const filtered = await importedFeed(db, "videos", {
    category: "Hard Enduro",
  });
  expect(filtered.items).toHaveLength(7);
  expect(
    filtered.items.every(
      (x) => "category" in x && x.category === "Hard Enduro",
    ),
  ).toBe(true);
  const empty = await importedFeed(db, "videos", {
    category: "Unsupported category",
  });
  expect(empty.items).toEqual([]);
  expect(empty.cursor).toBeNull();
});
