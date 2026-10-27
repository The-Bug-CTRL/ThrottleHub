import { beforeAll, afterAll, it, expect } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getBytes,
  updateMetadata,
  deleteObject,
} from "firebase/storage";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { listing, stolen, thread, testProject } from "./fixtures";
import {
  mutateListing,
  validateListingImages,
} from "../src/lib/listing-lifecycle";
let env: RulesTestEnvironment;
const admin = initializeApp({ projectId: testProject }, "security-audit");
const store = getFirestore(admin);
const bytes = new Uint8Array([137, 80, 78, 71]);
const as = (uid: string, claims = {}) => env.authenticatedContext(uid, claims);
beforeAll(async () => {
  if (
    process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8180" ||
    process.env.FIREBASE_STORAGE_EMULATOR_HOST !== "127.0.0.1:9298"
  )
    throw Error("Isolated test emulators required");
  env = await initializeTestEnvironment({
    projectId: testProject,
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
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    for (const status of [
      "published",
      "sold",
      "expired",
      "on-hold",
      "draft",
      "hidden",
      "removed",
    ])
      await setDoc(doc(db, "listings", `audit-${status}`), {
        ...listing("audit-owner", `audit-${status}`),
        status,
      });
    await setDoc(doc(db, "conversations", "audit-chat"), {
      buyerId: "audit-buyer",
      sellerId: "audit-owner",
      listingId: "audit-published",
      participants: ["audit-buyer", "audit-owner"],
    });
    await setDoc(doc(db, "restrictions", "audit-suspended"), {
      suspended: true,
    });
    await setDoc(
      doc(db, "listings", "audit-suspended-listing"),
      listing("audit-suspended", "audit-suspended-listing"),
    );
    await setDoc(
      doc(db, "forumThreads", "audit-thread"),
      thread("audit-owner"),
    );
    await setDoc(doc(db, "profiles", "audit-buyer"), {
      displayName: "Test member",
    });
    await setDoc(
      doc(db, "stolenReports", "audit-report"),
      stolen("audit-owner"),
    );
  });
});
afterAll(async () => {
  await env?.cleanup();
  await deleteApp(admin);
});
it.each(["published", "sold", "expired", "on-hold"])(
  "allows visitors to get retained %s listings",
  async (status) => {
    await assertSucceeds(
      getDoc(
        doc(
          env.unauthenticatedContext().firestore(),
          "listings",
          `audit-${status}`,
        ),
      ),
    );
  },
);
it.each(["draft", "hidden", "removed"])(
  "denies visitors private %s listings",
  async (status) => {
    await assertFails(
      getDoc(
        doc(
          env.unauthenticatedContext().firestore(),
          "listings",
          `audit-${status}`,
        ),
      ),
    );
  },
);
it("denies direct admin lifecycle bypass", async () => {
  await assertFails(
    updateDoc(
      doc(
        as("audit-admin", { admin: true }).firestore(),
        "listings",
        "audit-published",
      ),
      { status: "hidden", updatedAt: Date.now() },
    ),
  );
});
it("permits trusted admin moderation and denies moderator selling another advert", async () => {
  await expect(
    mutateListing(
      store,
      "audit-sold",
      { uid: "audit-mod", moderator: true },
      { action: "status", status: "removed" },
    ),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    mutateListing(
      store,
      "audit-expired",
      { uid: "audit-admin", admin: true },
      { action: "status", status: "hidden" },
    ),
  ).resolves.toMatchObject({ status: "hidden" });
});
it("denies suspended accounts through the Admin-backed service", async () => {
  await expect(
    mutateListing(
      store,
      "audit-suspended-listing",
      { uid: "audit-suspended" },
      { action: "status", status: "sold" },
    ),
  ).rejects.toMatchObject({ status: 403 });
});
it("permits an active buyer conversation with the real seller", async () => {
  await assertSucceeds(
    setDoc(
      doc(as("audit-buyer").firestore(), "conversations", "audit-new-chat"),
      {
        listingId: "audit-published",
        listingTitle: listing().title,
        buyerId: "audit-buyer",
        sellerId: "audit-owner",
        participants: ["audit-buyer", "audit-owner"],
        createdAt: Date.now(),
      },
    ),
  );
});
it.each([0, Date.now() + 86400000])(
  "denies forged message timestamp %s",
  async (createdAt) => {
    await assertFails(
      setDoc(
        doc(
          as("audit-buyer").firestore(),
          "conversations",
          "audit-chat",
          "messages",
          `invalid-${createdAt}`,
        ),
        { senderId: "audit-buyer", text: "Hello", createdAt },
      ),
    );
  },
);
it("permits current own read marker and denies forged future markers", async () => {
  const target = doc(
    as("audit-buyer").firestore(),
    "conversations",
    "audit-chat",
  );
  await assertSucceeds(
    updateDoc(target, { readAt: { "audit-buyer": Date.now() } }),
  );
  await assertFails(
    updateDoc(target, { readAt: { "audit-buyer": Date.now() + 86400000 } }),
  );
});
it("denies a public topic bump without a new reply", async () => {
  const db = as("audit-buyer").firestore(),
    batch = writeBatch(db);
  batch.set(doc(db, "postingLimits", "audit-buyer"), {
    lastPostAt: serverTimestamp(),
  });
  batch.update(doc(db, "forumThreads", "audit-thread"), {
    lastReplyAt: Date.now(),
    lastReplyId: "missing",
  });
  await assertFails(batch.commit());
});
it("permits the actual atomic reply-and-activity payload", async () => {
  const db = as("audit-buyer").firestore(),
    batch = writeBatch(db),
    now = Date.now();
  batch.set(doc(db, "postingLimits", "audit-buyer"), {
    lastPostAt: serverTimestamp(),
  });
  batch.set(doc(db, "forumThreads", "audit-thread", "replies", "audit-reply"), {
    ownerId: "audit-buyer",
    authorName: "Test member",
    status: "published",
    body: "An actual reply",
    createdAt: now,
    updatedAt: now,
  });
  batch.update(doc(db, "forumThreads", "audit-thread"), {
    lastReplyAt: now,
    lastReplyId: "audit-reply",
  });
  await assertSucceeds(batch.commit());
});
it("locks approved report photos while preserving public reads", async () => {
  const object = ref(
    as("audit-owner").storage(),
    "stolen-images/audit-owner/audit-report/test.png",
  );
  await assertSucceeds(
    uploadBytes(object, bytes, { contentType: "image/png" }),
  );
  await store.doc("stolenReports/audit-report").update({ status: "published" });
  await assertSucceeds(
    getBytes(ref(env.unauthenticatedContext().storage(), object.fullPath)),
  );
  await assertFails(uploadBytes(object, bytes, { contentType: "image/png" }));
  await assertFails(deleteObject(object));
  await assertFails(
    updateMetadata(object, { customMetadata: { injected: "true" } }),
  );
  await assertSucceeds(
    deleteObject(
      ref(as("audit-mod", { moderator: true }).storage(), object.fullPath),
    ),
  );
});
it("accepts own pending evidence paths and rejects foreign pointers or approved-report rewrites", async () => {
  await store.doc("stolenReports/audit-evidence").set(stolen("audit-owner"));
  const target = doc(
    as("audit-owner").firestore(),
    "stolenReports",
    "audit-evidence",
    "private",
    "evidence",
  );
  const evidence = {
    ownerId: "audit-owner",
    policeCase: "",
    frameId: "",
    engineId: "",
    note: "",
    paths: ["stolen-evidence/audit-owner/audit-evidence/test.pdf"],
  };
  await assertSucceeds(setDoc(target, evidence));
  await assertFails(
    setDoc(target, {
      ...evidence,
      paths: ["stolen-evidence/other/audit-evidence/test.pdf"],
    }),
  );
  await assertFails(
    setDoc(target, {
      ...evidence,
      paths: ["stolen-evidence/audit-owner/other-report/test.pdf"],
    }),
  );
  await store
    .doc("stolenReports/audit-evidence")
    .update({ status: "published" });
  await assertFails(setDoc(target, evidence));
});
it("allows admin news images and denies draft media to visitors and moderators", async () => {
  const object = ref(
    as("audit-admin", { admin: true }).storage(),
    "news-images/audit-news/test.png",
  );
  await assertSucceeds(
    uploadBytes(object, bytes, { contentType: "image/png" }),
  );
  await assertFails(
    getBytes(ref(env.unauthenticatedContext().storage(), object.fullPath)),
  );
  await assertFails(
    uploadBytes(
      ref(as("audit-mod", { moderator: true }).storage(), object.fullPath),
      bytes,
      { contentType: "image/png" },
    ),
  );
  await assertSucceeds(deleteObject(object));
});
it("denies direct listing photo staging, deletion and metadata changes", async () => {
  const object = ref(
    as("audit-owner").storage(),
    "listing-images/audit-owner/audit-draft/test.png",
  );
  await assertFails(uploadBytes(object, bytes, { contentType: "image/png" }));
  await assertFails(deleteObject(object));
  await assertFails(
    updateMetadata(object, { customMetadata: { injected: "true" } }),
  );
});
it("denies suspended uploads and unknown namespaces", async () => {
  await assertFails(
    uploadBytes(
      ref(
        as("audit-suspended").storage(),
        "listing-images/audit-suspended/audit-unused/test.png",
      ),
      bytes,
      { contentType: "image/png" },
    ),
  );
  await assertFails(
    uploadBytes(ref(as("audit-owner").storage(), "arbitrary/test.png"), bytes, {
      contentType: "image/png",
    }),
  );
});
it("reports malformed image URL escaping as client validation", () => {
  expect(() =>
    validateListingImages(
      ["https://firebasestorage.googleapis.com/v0/b/bucket/o/%ZZ"],
      "audit-owner",
      "id",
      "bucket",
      false,
    ),
  ).toThrow("Invalid photo URL");
});
