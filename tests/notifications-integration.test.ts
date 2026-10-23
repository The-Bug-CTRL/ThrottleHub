import { it, expect } from "vitest";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  initializeApp as clientApp,
  deleteApp as deleteClientApp,
} from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { notificationFeed } from "../src/lib/notification-feed";
import { testProject } from "./fixtures";
it.skipIf(process.env.RUN_FIREBASE_TESTS !== "true")(
  "isolates notification feeds and supports Google identities in the Auth emulator",
  async () => {
    if (
      process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8180" ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9299"
    )
      throw Error("Test emulators required");
    const app = initializeApp(
        { projectId: testProject },
        "extras-notifications",
      ),
      db = getFirestore(app),
      prefix = `extras-${crypto.randomUUID()}`,
      uid = prefix + "-buyer",
      other = prefix + "-seller",
      refs: ReturnType<typeof db.doc>[] = [];
    const client = clientApp(
      {
        projectId: testProject,
        apiKey: "test-key",
        authDomain: `${testProject}.firebaseapp.com`,
      },
      "google-extras",
    );
    const auth = getAuth(client);
    connectAuthEmulator(auth, "http://127.0.0.1:9299", {
      disableWarnings: true,
    });
    const put = async (path: string, data: Record<string, unknown>) => {
      const ref = db.doc(path);
      refs.push(ref);
      await ref.set(data);
    };
    try {
      const now = Date.now();
      await put(`conversations/${prefix}`, {
        participants: [uid, other],
        buyerId: uid,
        sellerId: other,
        listingTitle: "Test bike",
        createdAt: now - 100,
      });
      await put(`conversations/${prefix}/messages/received`, {
        senderId: other,
        text: "Private message text",
        createdAt: now - 50,
      });
      await put(`forumThreads/${prefix}`, {
        ownerId: uid,
        title: "Test discussion",
        status: "published",
        lastReplyAt: now - 40,
        createdAt: now - 90,
      });
      await put(`forumThreads/${prefix}/replies/reply`, {
        ownerId: other,
        authorName: "Other rider",
        body: "Private test reply",
        status: "published",
        createdAt: now - 40,
      });
      await put(`profiles/${uid}/reviews/${other}`, {
        authorName: "Other rider",
        rating: 5,
        status: "published",
        createdAt: Timestamp.fromMillis(now - 30),
        updatedAt: Timestamp.fromMillis(now - 30),
      });
      const feed = await notificationFeed(db, uid, now);
      expect(feed.unread).toBe(3);
      expect(new Set(feed.items.map((i) => i.kind))).toEqual(
        new Set(["message", "reply", "review"]),
      );
      expect(JSON.stringify(feed)).not.toContain("Private message text");
      const outsider = await notificationFeed(db, prefix + "-outsider", now);
      expect(outsider.items).toHaveLength(0);
      await put(`users/${uid}/preferences/notifications`, {
        lastReadAt: 0,
        readIds: [feed.items[0].id],
      });
      expect((await notificationFeed(db, uid, now)).unread).toBe(2);
      await db
        .doc(`users/${uid}/preferences/notifications`)
        .set({ lastReadAt: now });
      expect((await notificationFeed(db, uid, now)).unread).toBe(0);
      const token = [
        Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
          "base64url",
        ),
        Buffer.from(
          JSON.stringify({
            iss: "https://accounts.google.com",
            sub: prefix,
            email: `${prefix}@example.test`,
            email_verified: true,
            name: "Google test rider",
            aud: testProject,
            iat: Math.floor(now / 1000),
            exp: Math.floor(now / 1000) + 3600,
          }),
        ).toString("base64url"),
        "",
      ].join(".");
      const credential = await signInWithCredential(
        auth,
        GoogleAuthProvider.credential(token),
      );
      expect(
        credential.user.providerData.some((p) => p.providerId === "google.com"),
      ).toBe(true);
      expect(credential.user.displayName).toBe("Google test rider");
      const { getAuth: adminAuth } = await import("firebase-admin/auth");
      await adminAuth(app).deleteUser(credential.user.uid);
    } finally {
      for (const ref of refs.reverse()) await ref.delete();
      await deleteClientApp(client);
      await deleteApp(app);
    }
  },
  60000,
);
