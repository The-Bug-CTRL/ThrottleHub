import { seedReadyVideo } from "./video-fixture";
import { mutateListing as mutateListingService } from "../src/lib/listing-lifecycle";
import { it, expect } from "vitest";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  writeBatch,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import {
  getStorage,
  connectStorageEmulator,
  ref,
  uploadBytes,
  getDownloadURL,
  getBytes,
} from "firebase/storage";
import {
  initializeApp as initializeAdmin,
  deleteApp as deleteAdmin,
} from "firebase-admin/app";
import { getStorage as adminStorage } from "firebase-admin/storage";
import { getAuth as adminAuth } from "firebase-admin/auth";
import { getFirestore as adminFirestore } from "firebase-admin/firestore";
import { listing, article, thread, stolen, testProject } from "./fixtures";
it("runs independent Auth, marketplace, messaging, news, forum and stolen-report journeys with automatic cleanup", async () => {
  if (
    process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8180" ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9299"
  )
    throw new Error("Refusing non-test emulator endpoints.");
  const app = initializeApp(
    {
      projectId: testProject,
      apiKey: "test-key",
      storageBucket: `${testProject}.appspot.com`,
    },
    "test-workflow",
  );
  const auth = getAuth(app),
    db = getFirestore(app),
    storage = getStorage(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9299", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8180);
  connectStorageEmulator(storage, "127.0.0.1", 9298);
  const admin = initializeAdmin(
    { projectId: testProject, storageBucket: `${testProject}.appspot.com` },
    "test-admin",
  );
  const authAdmin = adminAuth(admin),
    store = adminFirestore(admin);
  function mutateListing(...args: Parameters<typeof mutateListingService>) {
    args[5] = adminStorage(admin).bucket();
    return mutateListingService(...args);
  }
  const uids: string[] = [],
    objects: string[] = [];
  const password = crypto.randomUUID() + "!";
  const suffix = crypto.randomUUID();
  const png = Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  try {
    const email = `seller-${suffix}@example.test`;
    const seller = (await createUserWithEmailAndPassword(auth, email, password))
      .user;
    uids.push(seller.uid);
    await setDoc(doc(db, "profiles", seller.uid), {
      displayName: "Test member",
      bio: "",
      city: "",
      country: "ZA",
      sellerType: "private",
      accountType: "personal",
      createdAt: Date.now(),
    });
    await signOut(auth);
    await expect(
      signInWithEmailAndPassword(auth, email, password + "wrong"),
    ).rejects.toThrow();
    await signInWithEmailAndPassword(auth, email, password);
    expect(auth.currentUser?.uid).toBe(seller.uid);
    await sendPasswordResetEmail(auth, email);
    const resetResponse = await fetch(
      `http://127.0.0.1:9299/emulator/v1/projects/${testProject}/oobCodes`,
    );
    const codes = await resetResponse.json();
    const reset = codes.oobCodes.find(
      (code: { email: string; requestType: string }) =>
        code.email === email && code.requestType === "PASSWORD_RESET",
    );
    expect(reset).toBeDefined();
    expect(await verifyPasswordResetCode(auth, reset.oobCode)).toBe(email);
    await confirmPasswordReset(auth, reset.oobCode, password);

    const id = `item-${suffix}`;
    await setDoc(doc(db, "listings", id), {
      ...listing(seller.uid, id),
      status: "draft",
      images: [],
    });
    await seedReadyVideo(store, id, seller.uid, adminStorage(admin).bucket());
    objects.push(`listing-videos/${seller.uid}/${id}/test-ready.mp4`);
    const imagePath = `listing-images/${seller.uid}/${id}/test.png`;
    objects.push(imagePath);
    await expect(
      uploadBytes(ref(storage, `listing-images/other/${id}/denied.png`), png, {
        contentType: "image/png",
      }),
    ).rejects.toThrow();
    await expect(
      uploadBytes(
        ref(storage, `listing-images/${seller.uid}/${id}/denied.txt`),
        png,
        { contentType: "text/plain" },
      ),
    ).rejects.toThrow();
    await adminStorage(admin)
      .bucket()
      .file(imagePath)
      .save(Buffer.from(png), { metadata: { contentType: "image/png" } });
    await adminStorage(admin)
      .bucket()
      .file(`listing-images/${seller.uid}/draft-private/test.png`)
      .save(Buffer.from(png), { metadata: { contentType: "image/png" } });
    objects.push(`listing-images/${seller.uid}/draft-private/test.png`);
    await expect(
      uploadBytes(
        ref(storage, `listing-images/${seller.uid}/${id}/too-big.png`),
        new Uint8Array(5 * 1024 * 1024 + 1),
        { contentType: "image/png" },
      ),
    ).rejects.toThrow();
    const url = await getDownloadURL(ref(storage, imagePath));
    await mutateListing(
      adminFirestore(admin),
      id,
      { uid: seller.uid },
      {
        action: "save",
        runningVideoId: "test-ready",
        status: "published",
        values: { ...listing(seller.uid, id), price: 500 },
        images: [url],
      },
    );
    expect((await getDoc(doc(db, "listings", id))).data()?.price).toBe(500);
    const reportId = `report-${suffix}`;
    const evidencePath = `stolen-evidence/${seller.uid}/${reportId}/ownership`;
    objects.push(evidencePath);
    await uploadBytes(ref(storage, evidencePath), png, {
      contentType: "image/png",
    });
    const batch = writeBatch(db);
    batch.set(doc(db, "stolenReports", reportId), stolen(seller.uid));
    batch.set(doc(db, "stolenReports", reportId, "private", "evidence"), {
      ownerId: seller.uid,
      policeCase: "private",
      frameId: "private",
      engineId: "",
      note: "",
      paths: [evidencePath],
    });
    await batch.commit();
    expect(
      (await getBytes(ref(storage, evidencePath))).byteLength,
    ).toBeGreaterThan(0);
    const buyer = (
      await createUserWithEmailAndPassword(
        auth,
        `buyer-${suffix}@example.test`,
        password,
      )
    ).user;
    uids.push(buyer.uid);
    await setDoc(doc(db, "profiles", buyer.uid), {
      displayName: "Test member",
      bio: "",
      city: "",
      country: "ZA",
      sellerType: "private",
      accountType: "personal",
      createdAt: Date.now(),
    });
    await setDoc(doc(db, "users", buyer.uid, "favourites", id), {
      listingId: id,
      createdAt: Date.now(),
    });
    await expect(
      getBytes(
        ref(storage, `listing-images/${seller.uid}/draft-private/test.png`),
      ),
    ).rejects.toThrow();
    await expect(
      uploadBytes(
        ref(storage, `listing-images/${buyer.uid}/${id}/wrong-parent.png`),
        png,
        { contentType: "image/png" },
      ),
    ).rejects.toThrow();
    const cid = `${id}_${buyer.uid}`;
    await runTransaction(db, async (transaction) => {
      const target = doc(db, "conversations", cid);
      const existing = await transaction.get(target);
      if (!existing.exists())
        transaction.set(target, {
          listingId: id,
          listingTitle: listing().title,
          buyerId: buyer.uid,
          sellerId: seller.uid,
          participants: [buyer.uid, seller.uid],
          createdAt: Date.now(),
        });
    });
    await addDoc(collection(db, "conversations", cid, "messages"), {
      senderId: buyer.uid,
      text: "A temporary test question.",
      createdAt: Date.now(),
    });
    await expect(
      getDoc(doc(db, "stolenReports", reportId, "private", "evidence")),
    ).rejects.toThrow();
    await expect(getBytes(ref(storage, evidencePath))).rejects.toThrow();
    await expect(
      uploadBytes(ref(storage, `news-images/test/denied.png`), png, {
        contentType: "image/png",
      }),
    ).rejects.toThrow();
    const tid = `thread-${suffix}`;
    const topic = writeBatch(db);
    topic.set(doc(db, "forumThreads", tid), thread(buyer.uid));
    topic.set(doc(db, "postingLimits", buyer.uid), {
      lastPostAt: serverTimestamp(),
    });
    await topic.commit();
    expect((await getDoc(doc(db, "forumThreads", tid))).data()?.ownerId).toBe(
      buyer.uid,
    );
    // Foreign published objects remain private even if a legacy document exists.
    const foreignId = `foreign-${suffix}`;
    await store
      .collection("listings")
      .doc(foreignId)
      .set({
        ...listing(seller.uid, foreignId),
        country: "GB",
        currency: "GBP",
      });
    const foreignPath = `listing-images/${seller.uid}/${foreignId}/private.png`;
    objects.push(foreignPath);
    await signOut(auth);
    expect(auth.currentUser).toBeNull();
    await signInWithEmailAndPassword(auth, email, password);
    await adminStorage(admin)
      .bucket()
      .file(foreignPath)
      .save(Buffer.from(png), { metadata: { contentType: "image/png" } });
    await signOut(auth);
    await expect(getBytes(ref(storage, foreignPath))).rejects.toThrow();
    await expect(
      getBytes(
        ref(storage, `listing-images/${seller.uid}/draft-private/test.png`),
      ),
    ).rejects.toThrow();
    await signInWithEmailAndPassword(
      auth,
      `buyer-${suffix}@example.test`,
      password,
    );
    await authAdmin.setCustomUserClaims(buyer.uid, { admin: true });
    await auth.currentUser!.getIdToken(true);
    const aid = `article-${suffix}`;
    await setDoc(doc(db, "newsArticles", aid), article(buyer.uid));
    await updateDoc(doc(db, "newsArticles", aid), {
      status: "published",
      publishedAt: Date.now(),
    });
    expect((await getDoc(doc(db, "newsArticles", aid))).data()?.status).toBe(
      "published",
    );
    await updateDoc(doc(db, "stolenReports", reportId), {
      status: "published",
      updatedAt: Date.now(),
    });
    await mutateListing(
      store,
      id,
      { uid: buyer.uid, admin: true },
      {
        action: "status",
        status: "hidden",
      },
    );
    await addDoc(collection(db, "communityActions"), {
      actorId: buyer.uid,
      targetCollection: "stolenReports",
      targetId: reportId,
      action: "publish",
      createdAt: Date.now(),
    });
  } finally {
    const { getStorage: adminStorage } = await import("firebase-admin/storage");
    for (const path of objects)
      await adminStorage(admin)
        .bucket()
        .file(path)
        .delete({ ignoreNotFound: true })
        .catch(() => {});
    for (const name of [
      "listings",
      "profiles",
      "users",
      "conversations",
      "stolenReports",
      "forumThreads",
      "postingLimits",
      "newsArticles",
      "communityActions",
    ]) {
      const snap = await store.collection(name).get();
      for (const d of snap.docs) await store.recursiveDelete(d.ref);
    }
    for (const uid of uids) await authAdmin.deleteUser(uid);
    await deleteApp(app);
    await deleteAdmin(admin);
  }
}, 30000);
