import { beforeAll, afterAll, it, expect, vi } from "vitest";
import sharp from "sharp";
vi.mock("../src/lib/server", () => ({ adminDb: () => db }));
vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    verifyIdToken: async (uid: string) => ({
      uid,
      admin: uid === "support-admin",
    }),
  }),
}));
vi.mock("firebase-admin/storage", async () => {
  const actual = await vi.importActual<typeof import("firebase-admin/storage")>(
    "firebase-admin/storage",
  );
  return { ...actual, getStorage: () => actual.getStorage(app) };
});
import { GET, PUT } from "../src/app/api/support/route";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  type DocumentReference,
} from "firebase/firestore";
function listenOnce(reference: DocumentReference) {
  return new Promise((resolve, reject) => {
    const stop = onSnapshot(
      reference,
      (value) => {
        stop();
        resolve(value);
      },
      (error) => {
        stop();
        reject(error);
      },
    );
  });
}
import { getBytes, ref, uploadBytes } from "firebase/storage";
import {
  supportMutation,
  assertSupportAccess,
  supportQuota,
} from "../src/lib/support-service";
const projectId = "demo-throttlehub-tests";
const app = initializeApp(
    { projectId, storageBucket: `${projectId}.appspot.com` },
    "support-tests",
  ),
  db = getFirestore(app);
let env: RulesTestEnvironment;
const customer = { uid: "support-customer", admin: false },
  other = { uid: "support-other", admin: false },
  admin = { uid: "support-admin", admin: true };
beforeAll(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8180")
    throw Error("Isolated emulator required");
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
});
afterAll(async () => {
  await env?.cleanup();
  await deleteApp(app);
});
it("the exact empty-sort homepage support query works without collections/counters; moderators never gain staff scope", async () => {
  const request = (uid: string, query = "?&sort=") =>
    new Request(`http://localhost/api/support${query}`, {
      headers: { authorization: `Bearer ${uid}` },
    });
  const response = await GET(request("support-empty-owner"));
  expect(response.status).toBe(200);
  expect((await response.json()).items).toEqual([]);
  const moderator = env.authenticatedContext("support-moderator", {
    moderator: true,
  });
  await assertFails(
    listenOnce(doc(moderator.firestore(), "supportSignals/staff")),
  );
  await assertFails(
    setDoc(doc(moderator.firestore(), "supportSignals/staff"), { unread: 10 }),
  );
  const result = await GET(request("support-moderator", "?priority=high"));
  expect(result.status).toBe(200);
  expect((await result.json()).items).toEqual([]);
});
const create = (actor = customer) =>
  supportMutation(db, actor, {
    action: "create",
    category: "Listings & Uploads",
    subject: "Upload help",
    text: "My genuine request for assistance",
  });
it("creates owned tickets; isolates customers and private notes; records replies, state, audit and exact unread counters", async () => {
  const { id } = await create();
  const ref = db.doc(`supportTickets/${id}`);
  expect(id).toMatch(/^TH-[A-F0-9]{24}$/);
  expect((await ref.get()).data()?.staffUnread).toBe(true);
  await expect(
    supportMutation(db, other, { action: "reply", id, text: "intrusion" }),
  ).rejects.toThrow("not found");
  await expect(
    supportMutation(db, customer, { action: "note", id, text: "fake staff" }),
  ).rejects.toThrow("Administrator");
  await expect(
    supportMutation(db, customer, { action: "priority", id, priority: "high" }),
  ).rejects.toThrow("Administrator");
  await supportMutation(db, admin, { action: "read", id });
  expect((await ref.get()).data()?.openedAt).toBeTypeOf("number");
  await supportMutation(db, admin, {
    action: "reply",
    id,
    text: "Please send a screenshot",
  });
  expect(
    (await db.doc(`supportSignals/user-${customer.uid}`).get()).data()?.unread,
  ).toBe(1);
  await supportMutation(db, admin, {
    action: "note",
    id,
    text: "Private investigation",
  });
  expect((await ref.collection("messages").get()).size).toBe(2);
  expect((await ref.collection("notes").get()).size).toBe(1);
  await supportMutation(db, customer, { action: "read", id });
  await supportMutation(db, customer, { action: "read", id });
  expect(
    (await db.doc(`supportSignals/user-${customer.uid}`).get()).data()?.unread,
  ).toBe(0);
  await supportMutation(db, customer, {
    action: "reply",
    id,
    text: "Here is more detail",
  });
  await supportMutation(db, admin, {
    action: "status",
    id,
    status: "resolved",
  });
  await expect(
    supportMutation(db, customer, { action: "reply", id, text: "closed" }),
  ).rejects.toThrow("Reopen");
  await supportMutation(db, customer, {
    action: "status",
    id,
    status: "waiting-staff",
  });
  expect((await ref.get()).data()?.status).toBe("waiting-staff");
  expect((await ref.collection("activity").get()).size).toBeGreaterThan(5);
  expect(() => assertSupportAccess(other, {})).toThrow();
});
it("enforces quotas and rejects spoofed fields", async () => {
  for (let n = 0; n < 2; n++) await supportQuota(db, "support-test-limit", 2);
  await expect(supportQuota(db, "support-test-limit", 2)).rejects.toThrow(
    "Too many",
  );
  await expect(
    supportMutation(db, customer, { action: "create", ownerId: other.uid }),
  ).rejects.toThrow();
});
it("client rules deny all ticket, note, screenshot and spoofed notification access; own/admin signals are read-only", async () => {
  const client = env.authenticatedContext(customer.uid),
    staff = env.authenticatedContext(admin.uid, { admin: true }),
    foreign = env.authenticatedContext(other.uid);
  await assertSucceeds(
    listenOnce(doc(client.firestore(), `supportSignals/user-${customer.uid}`)),
  );
  await assertSucceeds(
    listenOnce(doc(staff.firestore(), "supportSignals/staff")),
  );
  await assertFails(
    listenOnce(doc(foreign.firestore(), `supportSignals/user-${customer.uid}`)),
  );
  await assertFails(getDoc(doc(client.firestore(), "supportSignals/staff")));
  await assertFails(
    listenOnce(
      doc(env.unauthenticatedContext().firestore(), "supportSignals/staff"),
    ),
  );
  await assertFails(
    setDoc(doc(client.firestore(), `supportSignals/user-${customer.uid}`), {
      unread: 0,
    }),
  );
  await assertFails(
    getDoc(doc(client.firestore(), "supportTickets/example/notes/private")),
  );
  await assertFails(
    setDoc(doc(staff.firestore(), "supportTickets/example"), {
      ownerId: customer.uid,
    }),
  );
  await assertFails(
    uploadBytes(
      ref(client.storage(), "support-images/example/image.jpg"),
      new Uint8Array([1]),
      { contentType: "image/jpeg" },
    ),
  );
  await assertFails(
    getBytes(ref(client.storage(), "support-images/example/image.jpg")),
  );
});
it("serves sanitized screenshots only to owner/admin and paginates private history without leaking notes", async () => {
  const { id } = await create({ uid: "support-upload-owner", admin: false });
  const request = (
    suffix: string,
    uid = "support-upload-owner",
    method = "GET",
    body?: Uint8Array,
  ) =>
    new Request(`http://localhost/api/support?id=${id}${suffix}`, {
      method,
      headers: { authorization: `Bearer ${uid}` },
      ...(body ? { body: new Uint8Array(body) } : {}),
    });
  const bytes = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  const upload = await PUT(request("", undefined, "PUT", bytes));
  expect(upload.status).toBe(200);
  const attachment = (await upload.json()).id;
  const image = await GET(request(`&attachment=${attachment}`));
  expect(image.status).toBe(200);
  expect(image.headers.get("cache-control")).toBe("private, no-store");
  expect(
    (await sharp(Buffer.from(await image.arrayBuffer())).metadata()).format,
  ).toBe("jpeg");
  expect(
    (await GET(request(`&attachment=${attachment}`, other.uid))).status,
  ).toBe(404);
  expect((await PUT(request("", other.uid, "PUT", bytes))).status).toBe(404);
  expect((await GET(request("&section=notes"))).status).toBe(403);
  expect((await GET(request("&section=notes", admin.uid))).status).toBe(200);
  const batch = db.batch();
  for (let n = 0; n < 35; n++)
    batch.create(db.collection(`supportTickets/${id}/messages`).doc(), {
      text: `message ${n}`,
      createdAt: n,
      staff: false,
    });
  await batch.commit();
  const page = await (await GET(request(""))).json();
  expect(page.items).toHaveLength(30);
  const second = await (await GET(request(`&after=${page.next}`))).json();
  expect(second.items).toHaveLength(6);
  expect(new Set([...page.items, ...second.items].map((m) => m.id)).size).toBe(
    36,
  );
});
