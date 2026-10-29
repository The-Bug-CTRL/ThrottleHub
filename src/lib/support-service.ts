import { randomBytes } from "node:crypto";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { supportInput, type SupportActor } from "./support-model";
export class SupportError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function assertSupportAccess(
  actor: SupportActor,
  ticket: Record<string, unknown> | undefined,
) {
  if (!ticket || (!actor.admin && ticket.ownerId !== actor.uid))
    throw new SupportError("Request not found.", 404);
}
// Shared distributed quota; no in-memory limit that resets across processes.
export async function supportQuota(
  db: Firestore,
  key: string,
  maximum: number,
) {
  const ref = db.doc(`supportLimits/${key}`),
    now = Date.now();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref),
      d = snap.data();
    const count = d && d.until > now ? d.count : 0;
    if (count >= maximum)
      throw new SupportError("Too many requests. Please try again later.", 429);
    tx.set(ref, {
      count: count + 1,
      until: d && d.until > now ? d.until : now + 86400000,
    });
  });
}
export async function supportMutation(
  db: Firestore,
  actor: SupportActor,
  raw: unknown,
) {
  const input = supportInput.parse(raw);
  if (
    input.action === "create" &&
    (!input.category || !input.subject || !input.text)
  )
    throw new SupportError("Choose a category, subject and description.");
  if (["reply", "note"].includes(input.action) && !input.text)
    throw new SupportError("Enter a message.");
  if (["note", "priority"].includes(input.action) && !actor.admin)
    throw new SupportError("Administrator access required.", 403);
  if (input.action === "priority" && !input.priority)
    throw new SupportError("Choose a priority.");
  if (
    input.action === "status" &&
    (!input.status ||
      (!actor.admin && !["resolved", "waiting-staff"].includes(input.status)))
  )
    throw new SupportError("Invalid status.");
  if (input.action !== "create" && !input.id)
    throw new SupportError("Choose a ticket.");
  await supportQuota(
    db,
    `${actor.uid}-${input.action === "create" ? "create" : "actions"}`,
    input.action === "create" ? 5 : 120,
  );
  const id =
    input.action === "create"
      ? `TH-${randomBytes(12).toString("hex").toUpperCase()}`
      : input.id!;
  const ref = db.doc(`supportTickets/${id}`),
    now = Date.now();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref),
      old = snap.data();
    if (input.action !== "create") assertSupportAccess(actor, old);
    const d = old || {
      ownerId: actor.uid,
      guest: !!actor.guest,
      category: input.category!,
      subject: input.subject!,
      listingRef: input.listingRef || "",
      orderRef: input.orderRef || "",
      createdAt: now,
      status: "new",
      priority:
        input.category === "Safety, Fraud & Suspicious Activity"
          ? "high"
          : "normal",
      staffUnread: false,
      customerUnread: false,
      openedAt: null,
      attachmentCount: 0,
    };
    const before = { ...d };
    if (input.action === "reply" && d.status === "resolved")
      throw new SupportError("Reopen this request before replying.");
    if (input.action === "read") {
      d[actor.admin ? "staffUnread" : "customerUnread"] = false;
      if (actor.admin && !d.openedAt) d.openedAt = now;
    } else if (input.action === "priority") d.priority = input.priority;
    else if (input.action === "status") {
      d.status = input.status;
      if (
        ["new", "waiting-staff"].includes(String(d.status)) &&
        !["new", "waiting-staff"].includes(String(before.status))
      )
        d.waitingSince = now;
      d[actor.admin ? "customerUnread" : "staffUnread"] = true;
    } else if (input.action !== "note") {
      d.status =
        input.action === "create"
          ? "new"
          : actor.admin
            ? "waiting-customer"
            : "waiting-staff";
      d[actor.admin ? "customerUnread" : "staffUnread"] = true;
      if (
        !actor.admin &&
        !["new", "waiting-staff"].includes(String(before.status))
      )
        d.waitingSince = now;
    }
    if (input.action === "create") d.waitingSince = now;
    if (input.action === "priority" && input.priority === "high")
      d.staffUnread = true;
    if (input.action !== "read") d.updatedAt = now;
    tx.set(ref, d);
    if (input.text && ["create", "reply", "note"].includes(input.action))
      tx.create(
        ref.collection(input.action === "note" ? "notes" : "messages").doc(),
        {
          text: input.text,
          authorId: actor.uid,
          staff: actor.admin,
          createdAt: now,
        },
      );
    tx.create(ref.collection("activity").doc(), {
      action: input.action,
      actorId: actor.uid,
      staff: actor.admin,
      createdAt: now,
      status: d.status,
      priority: d.priority,
    });
    const counters = (v: Record<string, unknown> | undefined) => ({
      open: v && v.status !== "resolved" ? 1 : 0,
      unread: v?.staffUnread ? 1 : 0,
      waiting: v && ["new", "waiting-staff"].includes(String(v.status)) ? 1 : 0,
      customer: v?.status === "waiting-customer" ? 1 : 0,
      resolved: v?.status === "resolved" ? 1 : 0,
      high: v?.priority === "high" && v.status !== "resolved" ? 1 : 0,
    });
    const a = counters(old ? before : undefined),
      b = counters(d);
    tx.set(
      db.doc("supportSignals/staff"),
      {
        ...Object.fromEntries(
          Object.keys(a).map((k) => [
            k,
            FieldValue.increment(
              b[k as keyof typeof b] - a[k as keyof typeof a],
            ),
          ]),
        ),
        ...((!actor.admin &&
          ["create", "reply", "status"].includes(input.action)) ||
        (input.action === "priority" && input.priority === "high")
          ? { latestTicket: id, sequence: FieldValue.increment(1) }
          : {}),
      },
      { merge: true },
    );
    tx.set(
      db.doc(`supportSignals/user-${d.ownerId}`),
      {
        unread: FieldValue.increment(
          Number(!!d.customerUnread) - Number(!!old && !!before.customerUnread),
        ),
        updatedAt: now,
        ...(actor.admin && ["reply", "status"].includes(input.action)
          ? { latestTicket: id, sequence: FieldValue.increment(1) }
          : {}),
      },
      { merge: true },
    );
  });
  return { id };
}
