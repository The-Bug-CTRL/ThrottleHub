import { seedReadyVideo } from "./video-fixture";
import { beforeAll, afterAll, it, expect } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { finishListingMedia } from "../src/lib/listing-media";
import { readFileSync } from "node:fs";
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getBytes,
  deleteObject,
  getDownloadURL,
} from "firebase/storage";
import { listing, testProject } from "./fixtures";
import {
  mutateListing as mutateListingService,
  validateListingImages,
} from "../src/lib/listing-lifecycle";
import { isPublicListing, listingHref } from "../src/lib/listing-history";

const app = initializeApp({ projectId: testProject }, "history-tests");
const db = getFirestore(app);
let env: RulesTestEnvironment;
let isolated = false;
beforeAll(async () => {
  if (
    process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8180" ||
    process.env.FIREBASE_STORAGE_EMULATOR_HOST !== "127.0.0.1:9298"
  )
    throw Error("Isolated emulators required.");
  isolated = true;
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
});
afterAll(async () => {
  if (!isolated) {
    await deleteApp(app);
    return;
  }
  for (const d of (
    await db
      .collection("listings")
      .where("ownerId", "==", "history-seller")
      .get()
  ).docs)
    await db.recursiveDelete(d.ref);
  for (const id of ["history-removed", "history-anonymised"])
    await db.recursiveDelete(db.collection("listings").doc(id));
  await env?.cleanup();
  await deleteApp(app);
});
const seller = { uid: "history-seller" };
async function mutateListing(...args: Parameters<typeof mutateListingService>) {
  const [store, id, actor, input] = args;
  if (input.action === "save" || input.status === "published") {
    const old = (await store.doc("listings/" + id).get()).data();
    const uid = old?.ownerId || actor.uid;
    await seedReadyVideo(
      store,
      id,
      uid,
      getStorage(app).bucket(`${testProject}.appspot.com`),
    );
    args[3] = { ...input, runningVideoId: "test-ready" };
  }
  args[5] = getStorage(app).bucket(`${testProject}.appspot.com`);
  return mutateListingService(...args);
}
it("retains IDs, photos, prices and protected history through sold, expired, hold and relisting", async () => {
  const publicDb = env.unauthenticatedContext().firestore();
  for (const status of ["sold", "expired", "on-hold"] as const) {
    const id = `history-${status}`;
    const photo = `listing-images/${seller.uid}/${id}/photo.png`;
    const storage = env
      .authenticatedContext(seller.uid)
      .storage(`gs://${testProject}.appspot.com`);
    await getStorage(app)
      .bucket(`${testProject}.appspot.com`)
      .file(photo)
      .save(Buffer.from([1, 2, 3]), { metadata: { contentType: "image/png" } });
    const image = `http://127.0.0.1:9298/v0/b/${testProject}.appspot.com/o/${encodeURIComponent(photo)}?alt=media`;
    validateListingImages(
      [image],
      seller.uid,
      id,
      `${testProject}.appspot.com`,
      true,
    );
    await mutateListing(
      db,
      id,
      seller,
      {
        action: "save",
        status: "published",
        values: listing(seller.uid, id),
        images: [image],
      },
      1000,
    );
    const initial = (await db.doc(`listings/${id}`).get()).data()!;
    const link = listingHref({ id, slug: initial.slug });
    await mutateListing(
      db,
      id,
      seller,
      {
        action: "save",
        status: "published",
        values: {
          ...listing(seller.uid, id),
          title: "Renamed historical motorcycle",
          price: 200,
        },
        images: [image],
      },
      2000,
    );
    expect(link).toContain(id);
    await mutateListing(db, id, seller, { action: "status", status }, 3000);
    const record = (await getDoc(doc(publicDb, "listings", id))).data()!;
    expect(record.status).toBe(status);
    expect(record.price).toBe(200);
    expect(record.originalAskingPrice).toBe(100);
    expect(record.createdAt).toBe(1000);
    expect(record.lastStatusChangeAt).toBe(3000);
    expect(record.images).toEqual([image]);
    expect(isPublicListing(record as ReturnType<typeof listing>)).toBe(true);
    const active = await getDocs(
      query(
        collection(publicDb, "listings"),
        where("status", "==", "published"),
        where("country", "==", "ZA"),
        where("currency", "==", "ZAR"),
      ),
    );
    expect(active.docs.some((d) => d.id === id)).toBe(false);
    await assertSucceeds(
      getBytes(
        ref(
          env
            .unauthenticatedContext()
            .storage(`gs://${testProject}.appspot.com`),
          photo,
        ),
      ),
    );
    await assertFails(deleteObject(ref(storage, photo)));
    await assertFails(
      uploadBytes(ref(storage, photo), new Uint8Array([4]), {
        contentType: "image/png",
      }),
    );
    await assertFails(
      updateDoc(
        doc(env.authenticatedContext(seller.uid).firestore(), "listings", id),
        { status: "published", price: 1, soldAt: 0 },
      ),
    );
    await assertFails(
      setDoc(doc(publicDb, "conversations", `new-${id}`), { listingId: id }),
    );
    const buyer = env.authenticatedContext("history-buyer").firestore();
    await assertFails(
      setDoc(doc(buyer, "conversations", `new-${id}`), {
        listingId: id,
        listingTitle: record.title,
        buyerId: "history-buyer",
        sellerId: seller.uid,
        participants: ["history-buyer", seller.uid],
        createdAt: Date.now(),
      }),
    );
    await db.doc(`conversations/history-${status}`).set({
      listingId: id,
      listingTitle: record.title,
      buyerId: "history-buyer",
      sellerId: seller.uid,
      participants: ["history-buyer", seller.uid],
      createdAt: 1000,
    });
    await assertSucceeds(
      getDoc(doc(buyer, "conversations", `history-${status}`)),
    );
    await assertFails(
      getDoc(
        doc(
          env.authenticatedContext("outsider").firestore(),
          "conversations",
          `history-${status}`,
        ),
      ),
    );
    await assertFails(getDocs(collection(publicDb, "listings", id, "history")));
    const ownerDb = env.authenticatedContext(seller.uid).firestore();
    await assertSucceeds(
      getDocs(collection(ownerDb, "listings", id, "history")),
    );
    await assertFails(
      setDoc(doc(ownerDb, "listings", id, "history", "forged"), { at: 1 }),
    );
    await expect(
      mutateListing(
        db,
        id,
        { uid: "outsider" },
        { action: "status", status: "removed" },
      ),
    ).rejects.toThrow("not yours");
    await expect(
      mutateListing(db, id, seller, {
        action: "save",
        status: "published",
        values: listing(),
        images: [image],
      }),
    ).rejects.toThrow("cannot be edited");
    if (status !== "sold") {
      await mutateListing(
        db,
        id,
        seller,
        { action: "status", status: "published" },
        4000,
      );
      const relisted = (await db.doc(`listings/${id}`).get()).data()!;
      expect(relisted.id).toBe(id);
      expect(relisted.createdAt).toBe(1000);
      expect(relisted.originalAskingPrice).toBe(100);
    } else
      await expect(
        mutateListing(db, id, seller, {
          action: "status",
          status: "published",
        }),
      ).rejects.toThrow("not allowed");
    await env.withSecurityRulesDisabled(async (c) => {
      await deleteObject(
        ref(c.storage(`gs://${testProject}.appspot.com`), photo),
      );
    });
    await db.recursiveDelete(db.doc(`conversations/history-${status}`));
  }
}, 30000);

it("keeps drafts/rejections private and removes or de-identifies public data on request", async () => {
  const publicDb = env.unauthenticatedContext().firestore();
  for (const status of ["draft", "rejected", "hidden"]) {
    const id = `history-${status}`;
    await db.doc(`listings/${id}`).set({ ...listing(seller.uid, id), status });
    await assertFails(getDoc(doc(publicDb, "listings", id)));
    expect(
      isPublicListing({ ...listing(), status } as ReturnType<typeof listing>),
    ).toBe(false);
  }
  await mutateListing(db, "history-removed", seller, {
    action: "save",
    status: "published",
    values: listing(),
    images: ["test-photo"],
  });
  await mutateListing(db, "history-removed", seller, {
    action: "status",
    status: "removed",
  });
  const removed = (await db.doc("listings/history-removed").get()).data()!;
  expect(removed.title).toBeUndefined();
  expect(removed.images).toBeUndefined();
  expect(removed.price).toBeUndefined();
  await assertFails(getDoc(doc(publicDb, "listings", "history-removed")));
  await mutateListing(db, "history-anonymised", seller, {
    action: "save",
    status: "published",
    values: listing(),
    images: ["test-photo"],
  });
  await mutateListing(db, "history-anonymised", seller, {
    action: "status",
    status: "sold",
  });
  await expect(
    mutateListing(db, "history-anonymised", seller, { action: "anonymise" }),
  ).rejects.toThrow("Administrator");
  await mutateListing(
    db,
    "history-anonymised",
    { uid: "admin", admin: true },
    { action: "anonymise" },
  );
  const anonymised = (
    await getDoc(doc(publicDb, "listings", "history-anonymised"))
  ).data()!;
  expect(anonymised.ownerId).toBe("");
  expect(anonymised.images).toEqual([]);
  expect(anonymised.sellerAnonymised).toBe(true);
  expect(anonymised.specs).toBe("");
  expect(anonymised.details).toEqual({});
  expect(anonymised.make).toBe("Honda");
});

it("prevents direct publication and forged protected timestamps or asking-price history", async () => {
  const ownerDb = env.authenticatedContext(seller.uid).firestore();
  await assertFails(
    setDoc(
      doc(ownerDb, "listings", "history-forged"),
      listing(seller.uid, "history-forged"),
    ),
  );
  for (const fields of [
    { soldAt: 1 },
    { publishedAt: 1 },
    { originalAskingPrice: 1 },
    { lastStatusChangeAt: 1 },
  ]) {
    await assertFails(
      setDoc(doc(ownerDb, "listings", "history-forged"), {
        ...listing(seller.uid, "history-forged"),
        status: "draft",
        ...fields,
      }),
    );
  }
});

it("revokes token links on restriction and deletes originals, thumbnails and identifiers on removal", async () => {
  const id = "history-media";
  const client = env
    .authenticatedContext(seller.uid)
    .storage(`gs://${testProject}.appspot.com`);
  const bucket = getStorage(app).bucket(`${testProject}.appspot.com`);
  const paths = ["original.png", "thumbnail.png"].map(
    (name) => `listing-images/${seller.uid}/${id}/${name}`,
  );
  try {
    for (const path of paths)
      await bucket
        .file(path)
        .save(Buffer.from([1, 2, 3]), {
          metadata: {
            contentType: "image/png",
            metadata: { firebaseStorageDownloadTokens: crypto.randomUUID() },
          },
        });
    const urls = await Promise.all(
      paths.map((path) => getDownloadURL(ref(client, path))),
    );
    await mutateListing(db, id, seller, {
      action: "save",
      status: "published",
      values: listing(),
      images: [urls[0]],
    });
    expect((await fetch(urls[0])).status).toBe(200);
    await mutateListing(
      db,
      id,
      { uid: "admin", admin: true },
      { action: "status", status: "hidden" },
    );
    await finishListingMedia(db, id, bucket);
    expect((await fetch(urls[0])).ok).toBe(false);
    const restrictedPath = `listing-restricted/${seller.uid}/${id}/original.png`;
    expect((await bucket.file(restrictedPath).exists())[0]).toBe(true);
    await assertFails(getBytes(ref(client, restrictedPath)));
    const restrictedUrl = urls[0].replace(
      encodeURIComponent(paths[0]),
      encodeURIComponent(restrictedPath),
    );
    expect((await fetch(restrictedUrl)).ok).toBe(false);
    await assertFails(
      getBytes(
        ref(
          env
            .unauthenticatedContext()
            .storage(`gs://${testProject}.appspot.com`),
          paths[0],
        ),
      ),
    );
    await mutateListing(db, id, seller, {
      action: "status",
      status: "removed",
    });
    await finishListingMedia(db, id, bucket);
    for (const path of paths)
      expect((await bucket.file(path).exists())[0]).toBe(false);
    expect((await bucket.file(restrictedPath).exists())[0]).toBe(false);
    expect((await db.doc(`listings/${id}`).get()).data()?.ownerId).toBe("");
    expect((await db.collection(`listings/${id}/history`).get()).empty).toBe(
      true,
    );
    expect(
      (await db.doc(`listings/${id}/mediaCleanup/pending`).get()).exists,
    ).toBe(false);
  } finally {
    await bucket.deleteFiles({
      prefix: `listing-images/${seller.uid}/${id}/`,
      force: true,
    });
    await bucket.deleteFiles({
      prefix: `listing-restricted/${seller.uid}/${id}/`,
      force: true,
    });
    await db.recursiveDelete(db.doc(`listings/${id}`));
  }
}, 30000);
