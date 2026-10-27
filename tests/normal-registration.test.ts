import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  initializeApp as adminApp,
  deleteApp as deleteAdmin,
} from "firebase-admin/app";
import {
  getFirestore as adminFirestore,
  type Firestore,
} from "firebase-admin/firestore";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithCredential,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { listing, testProject } from "./fixtures";
import { emptyBusiness } from "../src/lib/seller-account";
let database: Firestore,
  app: ReturnType<typeof adminApp>,
  env: RulesTestEnvironment;
vi.mock("../src/lib/server", () => ({ adminDb: () => database }));
import { GET, POST, PATCH } from "../src/app/api/account/profile/route";
const clients: ReturnType<typeof initializeApp>[] = [],
  identities: string[] = [];
beforeAll(async () => {
  if (
    process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8180" ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9299"
  )
    throw Error("Isolated emulators required");
  app = adminApp({ projectId: testProject });
  database = adminFirestore(app);
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
  const { getAuth: adminAuth } = await import("firebase-admin/auth");
  for (const uid of identities) await adminAuth(app).deleteUser(uid);
  for (const client of clients) await deleteApp(client);
  await env?.cleanup();
  await deleteAdmin(app);
});
function client() {
  const app = initializeApp(
    {
      projectId: testProject,
      apiKey: "test-key",
      storageBucket: `${testProject}.appspot.com`,
    },
    `normal-${randomUUID()}`,
  );
  clients.push(app);
  const auth = getAuth(app),
    db = getFirestore(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9299", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8180);
  return { auth, db };
}
async function request(
  user: { getIdToken: () => Promise<string> },
  body?: unknown,
  method = "POST",
) {
  return new Request("http://localhost:3000/api/account/profile", {
    method,
    headers: {
      authorization: `Bearer ${await user.getIdToken()}`,
      "content-type": "application/json",
    },
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
  });
}
it("email registration, login, idempotent missing-profile repair and editing work without an approval document", async () => {
  const { auth, db } = client(),
    email = `normal-${randomUUID()}@example.test`,
    password = "Test-only-strong-pass1";
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  identities.push(user.uid);
  const waiting = await GET(await request(user, undefined, "GET"));
  expect(waiting.status).toBe(200);
  expect((await waiting.json()).needsSetup).toBe(true);
  const response = await POST(
    await request(user, {
      accountType: "personal",
      displayName: "Normal Rider",
    }),
  );
  expect(response.status).toBe(200);
  const before = (await database.doc(`profiles/${user.uid}`).get()).data()!;
  expect(before.accountType).toBe("personal");
  expect(before.email).toBeUndefined();
  await assertSucceeds(getDoc(doc(db, "profiles", user.uid)));
  const edit = await PATCH(
    await request(
      user,
      {
        accountType: "personal",
        displayName: "Updated Rider",
        bio: "Own profile",
        city: "",
        region: "",
        country: "ZA",
        photoURL: "",
        contactPhone: "",
      },
      "PATCH",
    ),
  );
  expect(edit.status).toBe(200);
  await signOut(auth);
  await signInWithEmailAndPassword(auth, email, password);
  expect(
    (await GET(await request(auth.currentUser!, undefined, "GET"))).status,
  ).toBe(200);
  expect(
    (await database.doc(`profiles/${user.uid}`).get()).data()?.createdAt,
  ).toBe(before.createdAt);
  expect(
    (
      await POST(
        await request(auth.currentUser!, {
          uid: "someone-else",
          accountType: "personal",
        }),
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await POST(
        await request(auth.currentUser!, {
          admin: true,
          accountType: "personal",
        }),
      )
    ).status,
  ).toBe(400);
  await assertFails(
    updateDoc(doc(db, "profiles", user.uid), { verified: true }),
  );
  await assertFails(
    setDoc(doc(db, "profiles", "foreign-normal-profile"), {
      ...before,
      createdAt: Date.now(),
    }),
  );
  expect(
    (await GET(new Request("http://localhost:3000/api/account/profile")))
      .status,
  ).toBe(401);
}, 30000);
it("first emulated Google login requires normal account-type onboarding and preserves an existing Business profile", async () => {
  const { auth } = client(),
    now = Math.floor(Date.now() / 1000),
    sub = randomUUID();
  const token = [
    Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        iss: "https://accounts.google.com",
        sub,
        email: `google-${sub}@example.test`,
        email_verified: true,
        name: "Google Seller",
        aud: testProject,
        iat: now,
        exp: now + 3600,
      }),
    ).toString("base64url"),
    "",
  ].join(".");
  const { user } = await signInWithCredential(
    auth,
    GoogleAuthProvider.credential(token),
  );
  identities.push(user.uid);
  expect((await (await POST(await request(user, {}))).json()).needsSetup).toBe(
    true,
  );
  const business = { ...emptyBusiness, name: "Test-only Workshop" };
  expect(
    (
      await POST(
        await request(user, {
          accountType: "business",
          business,
          displayName: "Google Seller",
        }),
      )
    ).status,
  ).toBe(200);
  const before = (await database.doc(`profiles/${user.uid}`).get()).data()!;
  expect(before.business).toEqual(business);
  expect(before.accountType).toBe("business");
  await signOut(auth);
  const again = await signInWithCredential(
    auth,
    GoogleAuthProvider.credential(token),
  );
  expect(
    (
      await POST(
        await request(again.user, {
          accountType: "personal",
          displayName: "Do not overwrite",
        }),
      )
    ).status,
  ).toBe(200);
  expect((await database.doc(`profiles/${user.uid}`).get()).data()).toEqual(
    before,
  );
}, 30000);
it("public browsing and ordinary account actions preserve ownership, private data and trusted media boundaries", async () => {
  const uid = `normal-owner-${randomUUID()}`,
    other = `normal-other-${randomUUID()}`,
    id = `normal-ad-${randomUUID()}`;
  const owner = env.authenticatedContext(uid),
    stranger = env.authenticatedContext(other),
    anon = env.unauthenticatedContext();
  const draft = { ...listing(uid, id), status: "draft", images: [] };
  await assertSucceeds(setDoc(doc(owner.firestore(), "listings", id), draft));
  await assertFails(
    updateDoc(doc(stranger.firestore(), "listings", id), {
      title: "Foreign change",
    }),
  );
  await assertFails(
    updateDoc(doc(owner.firestore(), "listings", id), { status: "published" }),
  );
  await assertFails(getDoc(doc(anon.firestore(), "listings", id)));
  await database.doc(`listings/${id}`).update({ status: "published" });
  await assertSucceeds(getDoc(doc(anon.firestore(), "listings", id)));
  await assertSucceeds(
    setDoc(doc(owner.firestore(), "users", uid, "favourites", id), {
      listingId: id,
      createdAt: Date.now(),
    }),
  );
  await assertFails(
    getDoc(doc(stranger.firestore(), "users", uid, "favourites", id)),
  );
  await assertFails(
    getDoc(doc(anon.firestore(), "users", uid, "favourites", id)),
  );
  await assertFails(
    uploadBytes(
      ref(owner.storage(), `listing-images/${uid}/${id}/bypass.jpg`),
      new Uint8Array([1]),
      { contentType: "image/jpeg" },
    ),
  );
  await assertFails(
    uploadBytes(
      ref(owner.storage(), `listing-videos/${uid}/${id}/accepted.mp4`),
      new Uint8Array([1]),
      { contentType: "video/mp4" },
    ),
  );
  await assertFails(
    uploadBytes(
      ref(owner.storage(), `listing-video-uploads/${uid}/missing/forged.mp4`),
      new Uint8Array([1]),
      { contentType: "video/mp4" },
    ),
  );
});
