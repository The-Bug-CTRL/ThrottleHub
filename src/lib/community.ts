"use client";
import { requestText } from "@/components/ui/dialogs";

import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  addDoc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "./firebase";
import { threadSchema, replySchema } from "./community-models";
import { slugify, tokens } from "./models";
export async function createThread(user: User, input: unknown) {
  const data = threadSchema.parse(input);
  const target = doc(collection(db, "forumThreads"));
  const now = Date.now();
  const profile = await getDoc(doc(db, "profiles", user.uid));
  const batch = writeBatch(db);
  batch.set(target, {
    ...data,
    ownerId: user.uid,
    authorName: profile.data()?.displayName || user.displayName || "Member",
    status: "published",
    locked: false,
    slug: slugify(data.title),
    createdAt: now,
    updatedAt: now,
    lastReplyAt: now,
    searchTokens: tokens(`${data.title} ${data.body}`),
  });
  batch.set(doc(db, "postingLimits", user.uid), {
    lastPostAt: serverTimestamp(),
  });
  await batch.commit();
  return target.id;
}
export async function createReply(
  user: User,
  threadId: string,
  input: unknown,
) {
  const data = replySchema.parse(input);
  const batch = writeBatch(db);
  const now = Date.now();
  const profile = await getDoc(doc(db, "profiles", user.uid));
  batch.set(doc(collection(db, "forumThreads", threadId, "replies")), {
    ...data,
    ownerId: user.uid,
    authorName: profile.data()?.displayName || user.displayName || "Member",
    status: "published",
    createdAt: now,
    updatedAt: now,
  });
  batch.set(doc(db, "postingLimits", user.uid), {
    lastPostAt: serverTimestamp(),
  });
  batch.update(doc(db, "forumThreads", threadId), { lastReplyAt: now });
  await batch.commit();
}
export async function reportContent(
  user: User,
  kind: "forum" | "stolen",
  targetId: string,
  replyId = "",
) {
  const reason = await requestText(
    "Describe the concern for the moderation team (at least 10 characters).",
  );
  if (!reason || reason.trim().length < 10) return;
  await addDoc(
    collection(db, kind === "forum" ? "forumReports" : "stolenFlags"),
    {
      targetId,
      replyId,
      reporterId: user.uid,
      reason: reason.trim().slice(0, 1500),
      status: "open",
      createdAt: Date.now(),
    },
  );
}
export async function moderateContent(
  user: User,
  collectionName: string,
  id: string,
  changes: Record<string, unknown>,
  action: string,
) {
  const batch = writeBatch(db);
  batch.update(doc(db, collectionName, id), {
    ...changes,
    updatedAt: Date.now(),
  });
  batch.set(doc(collection(db, "communityActions")), {
    actorId: user.uid,
    targetCollection: collectionName,
    targetId: id,
    action,
    createdAt: Date.now(),
  });
  await batch.commit();
}
export async function softDeletePost(path: string[], userId: string) {
  await updateDoc(doc(db, path[0], ...path.slice(1)), {
    status: "deleted",
    body: "[Post removed by its author]",
    updatedAt: Date.now(),
  });
  void userId;
}
