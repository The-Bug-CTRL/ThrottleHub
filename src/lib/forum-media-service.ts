import type { Firestore, Transaction } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import type { Bucket } from "@google-cloud/storage";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  forumTarget,
  forumKind,
  forumPath,
  attachmentSchema,
  type ForumAttachment,
} from "./forum-media-model";
import { threadSchema, replySchema } from "./community-models";
import { slugify, tokens } from "./models";
export class ForumError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const DAY = 86400000;
export async function checkForumTarget(
  db: Firestore,
  tx: Transaction,
  uid: string,
  target: z.infer<typeof forumTarget>,
) {
  const [restriction, parent, post] = await Promise.all([
    tx.get(db.doc(`restrictions/${uid}`)),
    tx.get(db.doc(`forumThreads/${target.threadId}`)),
    tx.get(db.doc(forumPath(target))),
  ]);
  if (
    restriction.data()?.suspended ||
    (parent.exists &&
      (parent.data()!.status !== "published" || parent.data()!.locked)) ||
    (target.replyId && !parent.exists) ||
    (post.exists &&
      (post.data()!.ownerId !== uid || post.data()!.status !== "published"))
  )
    throw new ForumError("You cannot attach media or edit this post.", 403);
  return post;
}
export async function beginForumMedia(
  db: Firestore,
  uid: string,
  input: unknown,
) {
  const value = z
      .object({ target: forumTarget, kind: forumKind })
      .strict()
      .parse(input),
    id = randomUUID(),
    now = Date.now();
  await db.runTransaction(async (tx) => {
    await checkForumTarget(db, tx, uid, value.target);
    const refs = [
      db.doc(`forumMediaQuotas/${uid}`),
      db.doc("forumMediaControl/daily"),
    ];
    const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));
    const counts = snapshots.map((s) =>
      s.data()?.since > now - DAY
        ? s.data()!
        : { since: now, count: 0, videos: 0 },
    );
    if (
      counts[0].count >= 20 ||
      (value.kind === "video" && counts[0].videos >= 3) ||
      counts[1].count >= 200 ||
      (value.kind === "video" && counts[1].videos >= 30)
    )
      throw new ForumError(
        "Today's forum upload limit has been reached. Try again tomorrow.",
        429,
      );
    refs.forEach((ref, i) =>
      tx.set(ref, {
        since: counts[i].since,
        count: counts[i].count + 1,
        videos: counts[i].videos + Number(value.kind === "video"),
      }),
    );
    tx.create(db.doc(`forumMedia/${id}`), {
      ...value,
      uid,
      status: "uploading",
      createdAt: now,
      expiresAt: now + 15 * 60000,
      sweepAt: now + DAY,
    });
  });
  return { id, kind: value.kind };
}
export async function claimForumUpload(db: Firestore, uid: string, id: string) {
  return db.runTransaction(async (tx) => {
    const ref = db.doc(`forumMedia/${id}`),
      snap = await tx.get(ref),
      record = snap.data();
    if (
      !record ||
      record.uid !== uid ||
      record.status !== "uploading" ||
      record.expiresAt <= Date.now()
    )
      throw new ForumError(
        "Upload slot is unavailable. Choose the file again.",
        409,
      );
    await checkForumTarget(db, tx, uid, record.target);
    const refSlots = db.doc("forumMediaControl/processing"),
      slots = await tx.get(refSlots);
    const leases = Object.fromEntries(
      Object.entries(slots.data()?.leases || {}).filter(
        ([, expiry]) => Number(expiry) > Date.now(),
      ),
    );
    if (Object.keys(leases).length >= 2)
      throw new ForumError("Media processing is busy. Retry shortly.", 429);
    tx.set(refSlots, { leases: { ...leases, [id]: Date.now() + 10 * 60000 } });
    tx.update(ref, { status: "processing" });
    return record;
  });
}
export async function releaseForumUpload(db: Firestore, id: string) {
  await db.runTransaction(async (tx) => {
    const ref = db.doc("forumMediaControl/processing"),
      snap = await tx.get(ref),
      leases = { ...snap.data()?.leases };
    delete leases[id];
    tx.set(ref, { leases });
  });
}
export async function saveForumMedia(
  db: Firestore,
  bucket: Bucket,
  uid: string,
  id: string,
  result: { bytes: Buffer; type: string; extension: string },
) {
  const path = `forum-media/${uid}/${id}.${result.extension}`,
    file = bucket.file(path);
  // No download token: reads always go through the status-aware application route.
  await file.save(result.bytes, {
    resumable: false,
    preconditionOpts: { ifGenerationMatch: 0 },
    metadata: { contentType: result.type, cacheControl: "private, no-store" },
  });
  const [metadata] = await file.getMetadata();
  try {
    await db.runTransaction(async (tx) => {
      const ref = db.doc(`forumMedia/${id}`),
        snap = await tx.get(ref),
        r = snap.data();
      if (!r || r.uid !== uid || r.status !== "processing")
        throw new ForumError("Upload was cancelled.", 409);
      await checkForumTarget(db, tx, uid, r.target);
      tx.update(ref, {
        status: "ready",
        path,
        generation: String(metadata.generation),
        size: result.bytes.length,
        type: result.type,
      });
    });
  } catch (e) {
    await file.delete({ ignoreNotFound: true });
    throw e;
  }
}
export async function discardForumMedia(
  db: Firestore,
  bucket: Bucket,
  uid: string,
  id: string,
) {
  const record = await db.runTransaction(async (tx) => {
    const ref = db.doc(`forumMedia/${id}`),
      snap = await tx.get(ref),
      r = snap.data();
    if (!r || r.uid !== uid) throw new ForumError("Attachment not found.", 404);
    if (r.status === "attached" || r.status === "processing")
      throw new ForumError(
        "Save the post without this attachment first, or wait for processing.",
        409,
      );
    tx.update(ref, { status: "discarded", sweepAt: Date.now() });
    return r;
  });
  if (record.path)
    await bucket.file(record.path).delete({ ignoreNotFound: true });
}
const mutationSchema = z
  .object({
    target: forumTarget,
    mode: z.enum(["create", "edit"]),
    body: z.string(),
    title: z.string().optional(),
    category: z.string().optional(),
    attachments: attachmentSchema.default([]),
  })
  .strict();
export async function publishForumPost(
  db: Firestore,
  bucket: Bucket,
  uid: string,
  input: unknown,
) {
  const value = mutationSchema.parse(input),
    now = Date.now();
  const data = value.target.replyId
    ? replySchema.parse(value)
    : value.mode === "create"
      ? threadSchema.parse(value)
      : replySchema
          .extend({ body: z.string().trim().min(2).max(12000) })
          .parse(value);
  await db.runTransaction(async (tx) => {
    const post = await checkForumTarget(db, tx, uid, value.target);
    if ((value.mode === "create") === post.exists)
      throw new ForumError("Post changed. Refresh before retrying.", 409);
    const [profile, cooldown, edits] = await Promise.all([
      tx.get(db.doc(`profiles/${uid}`)),
      tx.get(db.doc(`postingLimits/${uid}`)),
      tx.get(db.doc(`forumPostLimits/${uid}`)),
    ]);
    const changeCount =
      edits.data()?.since > now - 3600000 ? edits.data()!.count : 0;
    if (changeCount >= 60)
      throw new ForumError("Too many post changes. Try again later.", 429);
    if (!profile.exists)
      throw new ForumError("Complete your profile first.", 403);
    if (
      value.mode === "create" &&
      cooldown.data()?.lastPostAt?.toMillis() > now - 15000
    )
      throw new ForumError("Wait 15 seconds between posts.", 429);
    const oldAttachments = (post.data()?.attachments ||
      []) as ForumAttachment[];
    const ids = [
      ...new Set([...value.attachments, ...oldAttachments].map((a) => a.id)),
    ];
    const records = await Promise.all(
      ids.map((id) => tx.get(db.doc(`forumMedia/${id}`))),
    );
    for (const a of value.attachments) {
      const r = records.find((s) => s.id === a.id)?.data();
      if (
        !r ||
        r.uid !== uid ||
        forumPath(r.target) !== forumPath(value.target) ||
        r.kind !== a.kind ||
        !["ready", "attached"].includes(r.status) ||
        (r.status === "ready" && r.sweepAt <= now)
      )
        throw new ForumError(
          "Attachment is unavailable or belongs to another post.",
          403,
        );
      const [meta] = await bucket.file(r.path).getMetadata();
      if (
        String(meta.generation) !== r.generation ||
        Number(meta.size) !== r.size ||
        meta.contentType !== r.type
      )
        throw new ForumError("Attachment changed. Upload it again.", 409);
    }
    tx.set(edits.ref, {
      since: changeCount ? edits.data()!.since : now,
      count: changeCount + 1,
    });
    const base = { ...data, attachments: value.attachments, updatedAt: now };
    if (value.mode === "edit")
      tx.update(post.ref, {
        ...base,
        ...(!value.target.replyId
          ? { searchTokens: tokens(`${post.data()!.title} ${data.body}`) }
          : {}),
      });
    else {
      tx.create(post.ref, {
        ...base,
        ownerId: uid,
        authorName: profile.data()!.displayName,
        status: "published",
        createdAt: now,
        ...(!value.target.replyId
          ? {
              locked: false,
              slug: slugify(value.title!),
              lastReplyAt: now,
              searchTokens: tokens(`${value.title} ${data.body}`),
            }
          : {}),
      });
      tx.set(db.doc(`postingLimits/${uid}`), {
        lastPostAt: Timestamp.fromMillis(now),
      });
      if (value.target.replyId)
        tx.update(db.doc(`forumThreads/${value.target.threadId}`), {
          lastReplyAt: now,
          lastReplyId: value.target.replyId,
        });
    }
    for (const record of records) {
      if (!record.exists) continue;
      const included = value.attachments.some((a) => a.id === record.id);
      tx.update(record.ref, {
        status: included ? "attached" : "discarded",
        sweepAt: included ? now + 30 * DAY : now,
      });
    }
  });
  return { id: value.target.replyId || value.target.threadId };
}
export async function readableForumMedia(
  db: Firestore,
  id: string,
  uid?: string,
) {
  const snap = await db.doc(`forumMedia/${id}`).get(),
    r = snap.data();
  if (!r || !["ready", "attached"].includes(r.status))
    throw new ForumError("Media unavailable.", 404);
  if (r.status === "ready") {
    if (r.uid !== uid || r.sweepAt <= Date.now())
      throw new ForumError("Media unavailable.", 404);
  } else {
    const [post, parent] = await Promise.all([
      db.doc(forumPath(r.target)).get(),
      db.doc(`forumThreads/${r.target.threadId}`).get(),
    ]);
    if (
      post.data()?.status !== "published" ||
      parent.data()?.status !== "published" ||
      !(post.data()?.attachments || []).some(
        (a: ForumAttachment) => a.id === id,
      )
    )
      throw new ForumError("Media unavailable.", 404);
  }
  return r;
}
export async function pruneForumMedia(
  db: Firestore,
  bucket: Bucket,
  apply = false,
  now = Date.now(),
) {
  const candidates = await db
    .collection("forumMedia")
    .where("sweepAt", "<=", now)
    .orderBy("sweepAt")
    .limit(100)
    .get();
  let removed = 0,
    retained = 0;
  for (const candidate of candidates.docs) {
    const record = await db.runTransaction(async (tx) => {
      const snap = await tx.get(candidate.ref),
        r = snap.data();
      if (!r || r.sweepAt > now) return null;
      const post = await tx.get(db.doc(forumPath(r.target))),
        parent = await tx.get(db.doc(`forumThreads/${r.target.threadId}`));
      if (
        r.status === "attached" &&
        post.data()?.status === "published" &&
        parent.data()?.status === "published" &&
        (post.data()?.attachments || []).some(
          (a: ForumAttachment) => a.id === snap.id,
        )
      ) {
        if (apply) tx.update(snap.ref, { sweepAt: now + 30 * DAY });
        retained++;
        return null;
      }
      if (apply) tx.update(snap.ref, { status: "discarded" });
      return r;
    });
    if (!record) continue;
    if (apply) {
      if (record.path)
        await bucket.file(record.path).delete({ ignoreNotFound: true });
      // Derivable fallback also removes objects left by a crash before ready-record commit.
      for (const extension of ["jpg", "webp", "mp4"])
        await bucket
          .file(`forum-media/${record.uid}/${candidate.id}.${extension}`)
          .delete({ ignoreNotFound: true });
      await candidate.ref.delete();
    }
    removed++;
  }
  return {
    dryRun: !apply,
    scanned: candidates.size,
    removed,
    retained,
    more: candidates.size === 100,
  };
}
