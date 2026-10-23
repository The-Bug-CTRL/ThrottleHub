import type { Firestore } from "firebase-admin/firestore";
export interface ActivityNotification {
  id: string;
  kind: "message" | "reply" | "review";
  title: string;
  description: string;
  href: string;
  createdAt: number;
}
const milliseconds = (value: unknown): number =>
  typeof value === "number"
    ? value
    : value && typeof (value as { toMillis?: unknown }).toMillis === "function"
      ? (value as { toMillis: () => number }).toMillis()
      : 0;
export async function notificationFeed(
  db: Firestore,
  uid: string,
  now = Date.now(),
) {
  const [state, conversations, threads, reviews] = await Promise.all([
    db
      .collection("users")
      .doc(uid)
      .collection("preferences")
      .doc("notifications")
      .get(),
    db
      .collection("conversations")
      .where("participants", "array-contains", uid)
      .orderBy("createdAt", "desc")
      .limit(20)
      .get(),
    db
      .collection("forumThreads")
      .where("ownerId", "==", uid)
      .where("status", "==", "published")
      .orderBy("lastReplyAt", "desc")
      .limit(10)
      .get(),
    db
      .collection("profiles")
      .doc(uid)
      .collection("reviews")
      .where("status", "==", "published")
      .orderBy("createdAt", "desc")
      .limit(10)
      .get(),
  ]);
  const events: ActivityNotification[] = reviews.docs.map((d) => {
    const r = d.data();
    return {
      id: `review-${d.id}-${milliseconds(r.createdAt)}`,
      kind: "review",
      title: "New profile review",
      description: `${r.authorName} left a ${r.rating}-star review`,
      href: `/seller/${encodeURIComponent(uid)}#reviews`,
      createdAt: milliseconds(r.createdAt),
    };
  });
  await Promise.all(
    conversations.docs.map(async (conversation) => {
      const c = conversation.data(),
        other = c.buyerId === uid ? c.sellerId : c.buyerId;
      if (typeof other !== "string" || !c.participants.includes(uid)) return;
      const messages = await conversation.ref
        .collection("messages")
        .where("senderId", "==", other)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();
      const latest = messages.docs[0];
      if (!latest) return;
      const m = latest.data();
      events.push({
        id: `message-${conversation.id}-${latest.id}`,
        kind: "message",
        title: "New message",
        description: c.listingTitle || "Marketplace conversation",
        href: `/messages?conversation=${encodeURIComponent(conversation.id)}`,
        createdAt: milliseconds(m.createdAt),
      });
    }),
  );
  await Promise.all(
    threads.docs.map(async (thread) => {
      const replies = await thread.ref
        .collection("replies")
        .where("status", "==", "published")
        .orderBy("createdAt", "desc")
        .limit(5)
        .get();
      const reply = replies.docs.find((d) => d.data().ownerId !== uid);
      if (!reply) return;
      const r = reply.data();
      events.push({
        id: `reply-${thread.id}-${reply.id}`,
        kind: "reply",
        title: `${r.authorName} replied`,
        description: thread.data().title,
        href: `/forum/${encodeURIComponent(thread.id)}`,
        createdAt: milliseconds(r.createdAt),
      });
    }),
  );
  const lastReadAt = Number(state.data()?.lastReadAt) || 0;
  const readIds: string[] = Array.isArray(state.data()?.readIds)
    ? state.data()!.readIds
    : [];
  const isUnread = (event: ActivityNotification) =>
    event.createdAt > lastReadAt && !readIds.includes(event.id);
  const recent = events
    .filter(
      (event) =>
        Number.isFinite(event.createdAt) &&
        event.createdAt > 0 &&
        event.createdAt <= now,
    )
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 30);
  return {
    items: recent.map((event) => ({
      ...event,
      unread: isUnread(event),
    })),
    unread: recent.filter(isUnread).length,
    lastReadAt,
  };
}
