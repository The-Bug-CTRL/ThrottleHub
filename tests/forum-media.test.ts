import { beforeAll, afterAll, it, expect } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getBytes } from "firebase/storage";
import { processForumMedia } from "../src/lib/forum-media-processing";
import {
  beginForumMedia,
  claimForumUpload,
  releaseForumUpload,
  saveForumMedia,
  publishForumPost,
  readableForumMedia,
  discardForumMedia,
  pruneForumMedia,
} from "../src/lib/forum-media-service";
import { generateTestVideo } from "./video-fixture";
import { attachmentSchema } from "../src/lib/forum-media-model";
const projectId = "demo-throttlehub-tests",
  app = initializeApp(
    { projectId, storageBucket: `${projectId}.appspot.com` },
    "forum-media-test",
  ),
  db = getFirestore(app),
  bucket = getStorage(app).bucket();
let env: RulesTestEnvironment, photo: Buffer, folder: string;
beforeAll(async () => {
  if (
    process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8180" ||
    process.env.FIREBASE_STORAGE_EMULATOR_HOST !== "127.0.0.1:9298"
  )
    throw Error("Loopback emulators only");
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8180,
      rules: readFileSync("firestore.rules", "utf8"),
    },
    storage: {
      host: "127.0.0.1",
      port: 9298,
      rules: readFileSync("storage.rules", "utf8"),
    },
  });
  photo = await sharp({
    create: { width: 40, height: 30, channels: 3, background: "red" },
  })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  folder = await mkdtemp(path.join(tmpdir(), "forum-fixtures-"));
  for (const uid of ["forum-a", "forum-b"])
    await db.doc(`profiles/${uid}`).set({ displayName: uid });
});
afterAll(async () => {
  await env?.cleanup();
  await deleteApp(app);
  await rm(folder, { recursive: true, force: true });
});
async function ready(
  uid: string,
  threadId: string,
  replyId?: string,
  kind: "photo" | "video" | "gif" = "photo",
  bytes = photo,
) {
  const slot = await beginForumMedia(db, uid, {
    target: { threadId, ...(replyId ? { replyId } : {}) },
    kind,
  });
  await claimForumUpload(db, uid, slot.id);
  try {
    await saveForumMedia(
      db,
      bucket,
      uid,
      slot.id,
      await processForumMedia(bytes, kind),
    );
  } finally {
    await releaseForumUpload(db, slot.id);
  }
  return slot;
}
const text = "Here is some detailed riding advice for our community.";
it("sanitizes oriented photos, preserves bounded GIF animation and rejects corrupt/oversized/unsupported input", async () => {
  const result = await processForumMedia(photo, "photo"),
    meta = await sharp(result.bytes).metadata();
  expect([meta.width, meta.height]).toEqual([30, 40]);
  expect(meta.exif).toBeUndefined();
  const frames = Buffer.concat([
    Buffer.alloc(8 * 8 * 3, 20),
    Buffer.alloc(8 * 8 * 3, 200),
  ]);
  const gif = await sharp(frames, {
    raw: { width: 8, height: 16, channels: 3, pageHeight: 8 },
  })
    .gif({ delay: [100, 100] })
    .toBuffer();
  const animation = await processForumMedia(gif, "gif");
  expect(
    (await sharp(animation.bytes, { animated: true }).metadata()).pages,
  ).toBe(2);
  for (const kind of ["photo", "gif", "video"])
    await expect(
      processForumMedia(Buffer.from("not an image"), kind),
    ).rejects.toThrow();
  await expect(
    processForumMedia(Buffer.alloc(5 * 1024 * 1024 + 1), "photo"),
  ).rejects.toThrow();
  const slow = await sharp(frames, {
    raw: { width: 8, height: 16, channels: 3, pageHeight: 8 },
  })
    .gif({ delay: [6000, 6000] })
    .toBuffer();
  await expect(processForumMedia(slow, "gif")).rejects.toThrow();
});
it("validates short real H264 video separately from running-video rules and publishes playable video", async () => {
  const file = path.join(folder, "short.mp4");
  await generateTestVideo(file, 2, false);
  const video = await ready(
    "forum-a",
    "forum-video",
    undefined,
    "video",
    await readFile(file),
  );
  await db.doc("postingLimits/forum-a").delete();
  await publishForumPost(db, bucket, "forum-a", {
    target: { threadId: "forum-video" },
    mode: "create",
    title: "Short riding video",
    category: "general",
    body: text,
    attachments: [video],
  });
  const r = await readableForumMedia(db, video.id);
  const [bytes] = await bucket
    .file(r.path, { generation: r.generation })
    .download();
  expect(bytes.toString("ascii", 4, 8)).toBe("ftyp");
  const long = path.join(folder, "long.mp4");
  await generateTestVideo(long, 61, false);
  await expect(
    processForumMedia(await readFile(long), "video"),
  ).rejects.toThrow();
}, 60000);
it("binds multiple photos to exact owner/post, supports replies/edits, and revokes removed/hidden media", async () => {
  const a = await ready("forum-a", "forum-photos"),
    b = await ready("forum-a", "forum-photos");
  await expect(readableForumMedia(db, a.id)).rejects.toThrow();
  await expect(readableForumMedia(db, a.id, "forum-b")).rejects.toThrow();
  expect((await readableForumMedia(db, a.id, "forum-a")).status).toBe("ready");
  const input = {
    target: { threadId: "forum-photos" },
    mode: "create",
    title: "Suspension advice photos",
    category: "technical",
    body: text,
    attachments: [a, b],
  };
  await expect(
    publishForumPost(db, bucket, "forum-b", input),
  ).rejects.toThrow();
  await db.doc("postingLimits/forum-a").delete();
  await publishForumPost(db, bucket, "forum-a", input);
  expect((await readableForumMedia(db, a.id)).status).toBe("attached");
  await expect(
    discardForumMedia(db, bucket, "forum-a", a.id),
  ).rejects.toThrow();
  await expect(
    publishForumPost(db, bucket, "forum-b", { ...input, mode: "edit" }),
  ).rejects.toThrow();
  const r = await ready("forum-b", "forum-photos", "reply-one");
  await publishForumPost(db, bucket, "forum-b", {
    target: { threadId: "forum-photos", replyId: "reply-one" },
    mode: "create",
    body: "Thanks for the advice!",
    attachments: [r],
  });
  await publishForumPost(db, bucket, "forum-a", {
    ...input,
    mode: "edit",
    attachments: [b],
  });
  await expect(readableForumMedia(db, a.id)).rejects.toThrow();
  await db.doc("forumThreads/forum-photos").update({ locked: true });
  await expect(
    beginForumMedia(db, "forum-b", {
      target: { threadId: "forum-photos", replyId: "new" },
      kind: "photo",
    }),
  ).rejects.toThrow();
  await db.doc("forumThreads/forum-photos").update({ status: "hidden" });
  await expect(readableForumMedia(db, b.id)).rejects.toThrow();
  await expect(readableForumMedia(db, r.id)).rejects.toThrow();
});
it("rejects expired, forged, replaced and foreign slots; enforces quotas and global processing leases", async () => {
  const a = await beginForumMedia(db, "forum-a", {
    target: { threadId: "unpublished" },
    kind: "photo",
  });
  await expect(claimForumUpload(db, "forum-b", a.id)).rejects.toThrow();
  await db.doc(`forumMedia/${a.id}`).update({ expiresAt: 1 });
  await expect(claimForumUpload(db, "forum-a", a.id)).rejects.toThrow();
  const b = await ready("forum-a", "changed");
  const record = (await db.doc(`forumMedia/${b.id}`).get()).data()!;
  await bucket
    .file(record.path)
    .save(Buffer.from("replacement"), {
      metadata: { contentType: "image/jpeg" },
    });
  await db.doc("postingLimits/forum-a").delete();
  await expect(
    publishForumPost(db, bucket, "forum-a", {
      target: { threadId: "changed" },
      mode: "create",
      title: "Changed object test",
      category: "general",
      body: text,
      attachments: [b],
    }),
  ).rejects.toThrow();
  await db
    .doc("forumMediaControl/processing")
    .set({ leases: { a: Date.now() + 60000, b: Date.now() + 60000 } });
  const c = await beginForumMedia(db, "forum-a", {
    target: { threadId: "admission" },
    kind: "photo",
  });
  await expect(claimForumUpload(db, "forum-a", c.id)).rejects.toThrow("busy");
  await db.doc("forumMediaControl/processing").delete();
  await db
    .doc("forumMediaQuotas/quota-user")
    .set({ since: Date.now(), count: 20, videos: 0 });
  await expect(
    beginForumMedia(db, "quota-user", {
      target: { threadId: "random" },
      kind: "photo",
    }),
  ).rejects.toThrow("limit");
  await db.doc("restrictions/forum-suspended").set({ suspended: true });
  await expect(
    beginForumMedia(db, "forum-suspended", {
      target: { threadId: "random" },
      kind: "photo",
    }),
  ).rejects.toThrow();
  expect(
    attachmentSchema.safeParse(
      Array.from({ length: 6 }, (_, i) => ({ id: `photo${i}`, kind: "photo" })),
    ).success,
  ).toBe(false);
});
it("denies SDK media/ready-flag writes and private bytes even to client admins", async () => {
  for (const context of [
    env.unauthenticatedContext(),
    env.authenticatedContext("forum-a"),
    env.authenticatedContext("forum-b"),
    env.authenticatedContext("forum-admin", { admin: true }),
  ]) {
    await assertFails(
      setDoc(doc(context.firestore(), "forumMedia/forged"), {
        status: "ready",
        uid: "forum-a",
      }),
    );
    await assertFails(getDoc(doc(context.firestore(), "forumMedia/forged")));
    const file = ref(context.storage(), "forum-media/forum-a/forged.jpg");
    await assertFails(uploadBytes(file, photo, { contentType: "image/jpeg" }));
    await assertFails(getBytes(file));
  }
  await assertFails(
    updateDoc(
      doc(
        env.authenticatedContext("forum-a").firestore(),
        "forumThreads/forum-video",
      ),
      { attachments: [{ id: "fake", kind: "video" }] },
    ),
  );
});
it("sweeps abandoned objects safely, dry-runs without writes and retains current visible attachments", async () => {
  const slot = await ready("forum-a", "abandoned");
  await db.doc(`forumMedia/${slot.id}`).update({ sweepAt: 1 });
  const video = (await db.doc("forumThreads/forum-video").get()).data()!
    .attachments[0];
  await db.doc(`forumMedia/${video.id}`).update({ sweepAt: 1 });
  const dry = await pruneForumMedia(db, bucket);
  expect(dry.removed).toBeGreaterThan(0);
  expect((await db.doc(`forumMedia/${slot.id}`).get()).exists).toBe(true);
  await pruneForumMedia(db, bucket, true);
  expect((await db.doc(`forumMedia/${slot.id}`).get()).exists).toBe(false);
  expect((await readableForumMedia(db, video.id)).status).toBe("attached");
});
