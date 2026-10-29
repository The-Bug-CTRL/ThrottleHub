import { beforeAll, afterAll, it, expect } from "vitest";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  ensureProfile,
  editProfile,
  publicProfile,
} from "../src/lib/profile-service";
import { emptyBusiness } from "../src/lib/seller-account";
import { publicPhone } from "../src/lib/public-phone";
const projectId = "demo-throttlehub-tests",
  app = initializeApp({ projectId }, "release-privacy"),
  db = getFirestore(app);
let env: RulesTestEnvironment;
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
  });
});
afterAll(async () => {
  await env?.cleanup();
  await deleteApp(app);
});
it("stores contacts privately by default and only publishes explicit opt-in; withdrawal retains owner access", async () => {
  const uid = "privacy-business",
    business = {
      ...emptyBusiness,
      name: "Local workshop",
      phone: "+27831234567",
      email: "private@example.test",
    };
  await ensureProfile(db, uid, { accountType: "business", business });
  let profile = (await db.doc(`profiles/${uid}`).get()).data()!;
  expect(profile.business.phone).toBe("");
  expect(profile.business.email).toBe("");
  expect((await ensureProfile(db, uid, {})).profile?.business).toMatchObject({
    phone: business.phone,
    email: business.email,
  });
  const input = {
    accountType: "business",
    business,
    displayName: "Workshop",
    photoURL: "",
    bio: "",
    city: "",
    region: "",
    country: "ZA",
    contactPhone: "+27821234567",
  };
  await editProfile(db, uid, {
    ...input,
    contactPhonePublic: true,
    businessContactsPublic: true,
  });
  profile = (await db.doc(`profiles/${uid}`).get()).data()!;
  expect(publicPhone(profile)).toBe(business.phone);
  await assertSucceeds(
    getDoc(doc(env.unauthenticatedContext().firestore(), `profiles/${uid}`)),
  );
  await editProfile(db, uid, input);
  profile = (await db.doc(`profiles/${uid}`).get()).data()!;
  expect(profile.contactPhone).toBeUndefined();
  expect(profile.business.email).toBe("");
  expect((await ensureProfile(db, uid, {})).profile?.contactPhone).toBe(
    input.contactPhone,
  );
  for (const context of [
    env.unauthenticatedContext(),
    env.authenticatedContext(uid),
    env.authenticatedContext("foreign"),
    env.authenticatedContext("staff", { admin: true }),
  ]) {
    await assertFails(
      getDoc(doc(context.firestore(), `profileContacts/${uid}`)),
    );
    await assertFails(
      setDoc(doc(context.firestore(), `profileContacts/${uid}`), {
        contactPhone: "fake",
      }),
    );
  }
});
it("legacy contacts stay hidden without rewriting records; public projection and Rules fail closed", async () => {
  const uid = "privacy-legacy",
    legacy = {
      displayName: "Legacy",
      contactPhone: "+27821234567",
      business: {
        ...emptyBusiness,
        name: "Legacy shop",
        phone: "+27831234567",
        email: "legacy@example.test",
      },
    };
  await db.doc(`profiles/${uid}`).set(legacy);
  const projection = publicProfile(legacy);
  expect(projection.contactPhone).toBeUndefined();
  expect(projection.business).toMatchObject({ phone: "", email: "" });
  expect(publicPhone(legacy)).toBe("");
  await assertFails(
    getDoc(doc(env.unauthenticatedContext().firestore(), `profiles/${uid}`)),
  );
  await assertFails(
    getDoc(
      doc(env.authenticatedContext("foreign").firestore(), `profiles/${uid}`),
    ),
  );
  await assertSucceeds(
    getDoc(doc(env.authenticatedContext(uid).firestore(), `profiles/${uid}`)),
  );
  await ensureProfile(db, uid, {});
  expect((await db.doc(`profiles/${uid}`).get()).data()).toEqual(legacy);
});
