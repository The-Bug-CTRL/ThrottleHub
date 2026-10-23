import { beforeAll, afterAll, describe, it, expect } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
  deleteDoc,
  collection,
  getCountFromServer,
} from "firebase/firestore";
import { listing, thread, article, stolen, testProject } from "./fixtures";
import { setFollowing } from "../src/lib/follows";
let env: RulesTestEnvironment;
beforeAll(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8180")
    throw new Error("Tests require isolated loopback Firestore port 8180.");
  env = await initializeTestEnvironment({
    projectId: testProject,
    firestore: {
      host: "127.0.0.1",
      port: 8180,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, "listings", "item"), listing());
    await setDoc(doc(db, "listings", "draft"), {
      ...listing("seller", "draft"),
      status: "draft",
    });
    await setDoc(doc(db, "conversations", "conversation"), {
      participants: ["buyer", "seller"],
      buyerId: "buyer",
      sellerId: "seller",
      listingId: "item",
    });
    for (const uid of ["writer", "reporter", "buyer"])
      await setDoc(doc(db, "profiles", uid), {
        displayName: "Test member",
        bio: "",
        city: "",
        country: "ZA",
        sellerType: "private",
        createdAt: Date.now(),
      });
    await setDoc(doc(db, "forumThreads", "topic"), thread());
    await setDoc(doc(db, "forumThreads", "locked"), {
      ...thread(),
      locked: true,
    });
    await setDoc(doc(db, "newsArticles", "draft"), article());
    await setDoc(doc(db, "newsArticles", "published"), {
      ...article(),
      status: "published",
      publishedAt: Date.now(),
    });
    await setDoc(doc(db, "stolenReports", "report"), stolen());
    await setDoc(doc(db, "stolenReports", "public"), {
      ...stolen(),
      status: "published",
    });
    await setDoc(doc(db, "stolenReports", "report", "private", "evidence"), {
      ownerId: "reporter",
      policeCase: "sensitive",
      frameId: "private-identifier",
      engineId: "",
      note: "",
      paths: [],
    });
  });
});
afterAll(async () => {
  await env?.clearFirestore();
  await env?.cleanup();
});
const as = (uid: string, claims = {}) =>
  env.authenticatedContext(uid, claims).firestore();
describe("V2 market write boundaries", () => {
  it("rejects foreign listings, currencies, categories, paths and unsupported provinces", async () => {
    const db = as("seller");
    for (const changes of [
      { country: "GB" },
      { currency: "USD" },
      { categoryId: "not-a-category" },
      { categoryPath: { l0: "parts" } },
      { region: "London" },
    ]) {
      await assertFails(
        setDoc(doc(db, "listings", "v2-invalid"), {
          ...listing("seller", "v2-invalid"),
          status: "draft",
          ...changes,
        }),
      );
    }
    await assertSucceeds(
      setDoc(doc(db, "listings", "v2-valid"), {
        ...listing("seller", "v2-valid"),
        status: "draft",
      }),
    );
  });
  it("accepts deep part categories and rejects forged engine compatibility", async () => {
    const { categoryFields } = await import("../src/lib/taxonomy");
    const l = {
      ...listing("seller", "v2-part"),
      status: "draft",
      ...categoryFields("parts/exhaust/two-stroke-expansion-chambers"),
      details: { ...listing().details, engineType: "two-stroke" },
    };
    await assertSucceeds(setDoc(doc(as("seller"), "listings", "v2-part"), l));
    await assertFails(
      updateDoc(doc(as("seller"), "listings", "v2-part"), {
        "details.engineType": "four-stroke",
      }),
    );
    const deep = {
      ...l,
      ...categoryFields("parts/engine/top-end/cylinder-heads"),
      id: "v2-deep",
    };
    await assertSucceeds(
      setDoc(doc(as("seller"), "listings", "v2-deep"), deep),
    );
    const watch = {
      ...l,
      ...categoryFields("electronics/watches-wearables/gps-watches"),
      id: "v2-watch",
      make: "",
      model: "",
      year: 0,
      details: listing().details,
    };
    await assertSucceeds(
      setDoc(doc(as("seller"), "listings", "v2-watch"), watch),
    );
  });
  it("keeps legacy foreign records intact and private to their owner", async () => {
    await env.withSecurityRulesDisabled((c) =>
      setDoc(doc(c.firestore(), "listings", "foreign"), {
        ...listing("seller", "foreign"),
        country: "GB",
        currency: "GBP",
      }),
    );
    await assertFails(
      getDoc(
        doc(env.unauthenticatedContext().firestore(), "listings", "foreign"),
      ),
    );
    await assertSucceeds(getDoc(doc(as("seller"), "listings", "foreign")));
  });
  it("saves structured private searches, denies other users and notification claims", async () => {
    const { defaultFilters } = await import("../src/lib/search-contract");
    const saved = {
      name: "GPS watches",
      filters: {
        ...defaultFilters,
        category: "electronics/watches-wearables/gps-watches",
      },
      version: 2,
      createdAt: Date.now(),
      notificationsEnabled: false,
    };
    await assertSucceeds(
      setDoc(doc(as("buyer"), "users", "buyer", "savedSearches", "gps"), saved),
    );
    await assertFails(
      getDoc(doc(as("attacker"), "users", "buyer", "savedSearches", "gps")),
    );
    await assertFails(
      setDoc(doc(as("buyer"), "users", "buyer", "savedSearches", "bad"), {
        ...saved,
        notificationsEnabled: true,
      }),
    );
    await assertFails(
      setDoc(doc(as("buyer"), "users", "buyer", "savedSearches", "bad"), {
        ...saved,
        filters: { ...saved.filters, country: "US" },
      }),
    );
    await assertSucceeds(
      deleteDoc(doc(as("buyer"), "users", "buyer", "savedSearches", "gps")),
    );
  });
  it("rejects foreign regional reports and events while keeping drafts editable", async () => {
    await assertFails(
      setDoc(doc(as("reporter"), "stolenReports", "foreign"), {
        ...stolen(),
        country: "AU",
      }),
    );
    const event = {
      ownerId: "admin",
      title: "Temporary local event",
      body: "An isolated regional event validation test.",
      type: "Enduro",
      startsAt: 1,
      endsAt: 2,
      country: "US",
      region: "ZA-GP",
      city: "Test Town",
      venue: "",
      organizer: "Test",
      link: "",
      status: "draft",
      createdAt: 1,
      updatedAt: 1,
    };
    await assertFails(
      setDoc(doc(as("admin", { admin: true }), "events", "foreign"), event),
    );
    await assertSucceeds(
      setDoc(doc(as("seller"), "listings", "v2-draft"), {
        ...listing("seller", "v2-draft"),
        status: "draft",
        title: "",
        description: "",
        region: "",
        city: "",
        price: 0,
      }),
    );
    await assertFails(
      updateDoc(doc(as("seller"), "listings", "v2-draft"), {
        status: "published",
      }),
    );
  });
});
describe("Existing marketplace boundaries", () => {
  it("allows public adverts and hides drafts", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "listings", "item")));
    await assertFails(getDoc(doc(db, "listings", "draft")));
  });
  it("blocks editing another advert and ownership transfer", async () => {
    await assertFails(
      updateDoc(doc(as("attacker"), "listings", "item"), { price: 1 }),
    );
    await assertFails(
      updateDoc(doc(as("seller"), "listings", "item"), { ownerId: "attacker" }),
    );
  });
  it("blocks self-admin promotion and private email publication", async () => {
    await assertFails(
      setDoc(doc(as("buyer"), "profiles", "buyer"), {
        admin: true,
        displayName: "Buyer",
      }),
    );
    await assertFails(
      setDoc(doc(as("buyer"), "profiles", "buyer"), {
        displayName: "Buyer",
        bio: "",
        city: "",
        country: "ZA",
        sellerType: "private",
        createdAt: Date.now(),
        email: "private@example.test",
      }),
    );
  });
  it("isolates conversations and message senders", async () => {
    await assertSucceeds(
      getDoc(doc(as("buyer"), "conversations", "not-yet-created")),
    );
    await assertFails(
      getDoc(doc(as("attacker"), "conversations", "conversation")),
    );
    await assertSucceeds(
      getDoc(doc(as("buyer"), "conversations", "conversation")),
    );
    await assertFails(
      setDoc(
        doc(as("buyer"), "conversations", "conversation", "messages", "spoof"),
        { senderId: "seller", text: "spoof", createdAt: Date.now() },
      ),
    );
    await assertFails(
      updateDoc(doc(as("buyer"), "conversations", "conversation"), {
        participants: ["buyer", "attacker"],
      }),
    );
    await assertSucceeds(
      setDoc(
        doc(as("buyer"), "conversations", "conversation", "messages", "valid"),
        {
          senderId: "buyer",
          text: "A legitimate question",
          createdAt: Date.now(),
        },
      ),
    );
  });
  it("prevents buyer-to-self conversations", async () => {
    await assertFails(
      setDoc(doc(as("seller"), "conversations", "self"), {
        buyerId: "seller",
        sellerId: "seller",
        participants: ["seller", "seller"],
        listingId: "item",
        listingTitle: "Item",
        createdAt: Date.now(),
      }),
    );
  });
});
describe("Forum ownership, moderation and abuse controls", () => {
  it("allows owner editing, denies intruders and identity changes", async () => {
    await assertSucceeds(
      updateDoc(doc(as("writer"), "forumThreads", "topic"), {
        body: "An updated legitimate original post.",
        updatedAt: Date.now(),
      }),
    );
    await assertFails(
      updateDoc(doc(as("attacker"), "forumThreads", "topic"), {
        body: "unauthorised edit",
      }),
    );
    await assertFails(
      updateDoc(doc(as("writer"), "forumThreads", "topic"), {
        ownerId: "attacker",
      }),
    );
  });
  it("requires an atomic cooldown token and denies rapid posting", async () => {
    const db = as("buyer");
    await assertFails(
      setDoc(doc(db, "forumThreads", "no-cooldown"), thread("buyer")),
    );
    const batch = writeBatch(db);
    batch.set(doc(db, "forumThreads", "new-topic"), thread("buyer"));
    batch.set(doc(db, "postingLimits", "buyer"), {
      lastPostAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
    const second = writeBatch(db);
    second.set(doc(db, "forumThreads", "rapid-topic"), thread("buyer"));
    second.set(doc(db, "postingLimits", "buyer"), {
      lastPostAt: serverTimestamp(),
    });
    await assertFails(second.commit());
  });
  it("denies locked discussion replies and non-moderator locking", async () => {
    await env.withSecurityRulesDisabled((c) =>
      setDoc(doc(c.firestore(), "postingLimits", "writer"), {
        lastPostAt: Timestamp.fromMillis(1),
      }),
    );
    const db = as("writer");
    const batch = writeBatch(db);
    batch.set(doc(db, "forumThreads", "locked", "replies", "reply"), {
      body: "A reply to locked topic",
      ownerId: "writer",
      authorName: "Test member",
      status: "published",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    batch.set(doc(db, "postingLimits", "writer"), {
      lastPostAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
    await assertFails(
      updateDoc(doc(db, "forumThreads", "topic"), { locked: true }),
    );
    await assertSucceeds(
      updateDoc(
        doc(as("moderator", { moderator: true }), "forumThreads", "topic"),
        { locked: true, updatedAt: Date.now() },
      ),
    );
  });
  it("enforces moderator restrictions and denies self-unrestriction", async () => {
    await setDoc(
      doc(as("moderator", { moderator: true }), "restrictions", "writer"),
      {
        suspended: true,
        reason: "Automated test",
        actorId: "moderator",
        updatedAt: Date.now(),
      },
    );
    await assertFails(
      updateDoc(doc(as("writer"), "restrictions", "writer"), {
        suspended: false,
      }),
    );
    await assertFails(
      updateDoc(doc(as("writer"), "forumThreads", "locked"), {
        body: "Forbidden while restricted",
      }),
    );
  });
});
describe("Editorial publication", () => {
  it("protects event drafts and limits event publication to admins", async () => {
    const event = {
      ownerId: "editor",
      title: "Temporary event permission test",
      body: "A temporary event used only by the automated test runner.",
      type: "Enduro",
      startsAt: 100,
      endsAt: 200,
      country: "ZA",
      region: "ZA-GP",
      city: "Test City",
      venue: "",
      organizer: "Test organizer",
      link: "https://example.test",
      status: "draft",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await assertFails(
      setDoc(doc(as("writer"), "events", "rogue"), {
        ...event,
        ownerId: "writer",
      }),
    );
    await assertSucceeds(
      setDoc(doc(as("editor", { admin: true }), "events", "event"), event),
    );
    await assertFails(
      getDoc(doc(env.unauthenticatedContext().firestore(), "events", "event")),
    );
    await assertSucceeds(
      updateDoc(doc(as("editor", { admin: true }), "events", "event"), {
        status: "published",
      }),
    );
    await assertSucceeds(
      getDoc(doc(env.unauthenticatedContext().firestore(), "events", "event")),
    );
  });
  it("keeps drafts private and published articles public", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "newsArticles", "draft")));
    await assertSucceeds(getDoc(doc(db, "newsArticles", "published")));
  });
  it("denies ordinary members and moderators official news publishing", async () => {
    await assertFails(
      setDoc(doc(as("writer"), "newsArticles", "rogue"), article("writer")),
    );
    await assertFails(
      setDoc(
        doc(as("moderator", { moderator: true }), "newsArticles", "rogue"),
        article("moderator"),
      ),
    );
    await assertSucceeds(
      setDoc(
        doc(as("editor", { admin: true }), "newsArticles", "admin"),
        article("editor"),
      ),
    );
    await assertSucceeds(
      updateDoc(doc(as("editor", { admin: true }), "newsArticles", "admin"), {
        status: "published",
        publishedAt: Date.now(),
      }),
    );
  });
});
describe("Stolen-report privacy and controlled lifecycle", () => {
  it("hides unreviewed reports and restricts evidence to owners/moderators", async () => {
    await assertFails(
      getDoc(
        doc(
          env.unauthenticatedContext().firestore(),
          "stolenReports",
          "report",
        ),
      ),
    );
    await assertSucceeds(
      getDoc(
        doc(as("reporter"), "stolenReports", "report", "private", "evidence"),
      ),
    );
    await assertFails(
      getDoc(
        doc(as("attacker"), "stolenReports", "report", "private", "evidence"),
      ),
    );
    await assertSucceeds(
      getDoc(
        doc(
          as("moderator", { moderator: true }),
          "stolenReports",
          "report",
          "private",
          "evidence",
        ),
      ),
    );
  });
  it("denies owner self-publication, spoofing and evidence leakage into public fields", async () => {
    await assertFails(
      updateDoc(doc(as("reporter"), "stolenReports", "report"), {
        status: "published",
      }),
    );
    await assertFails(
      updateDoc(doc(as("reporter"), "stolenReports", "report"), {
        ownerId: "attacker",
      }),
    );
    await assertFails(
      setDoc(doc(as("reporter"), "stolenReports", "leak"), {
        ...stolen(),
        policeCase: "sensitive",
      }),
    );
  });
  it("allows moderator publication and owner recovery but not public-content replacement", async () => {
    await assertSucceeds(
      updateDoc(
        doc(as("moderator", { moderator: true }), "stolenReports", "report"),
        { status: "published", updatedAt: Date.now() },
      ),
    );
    await assertFails(
      updateDoc(doc(as("reporter"), "stolenReports", "report"), {
        description: "Changing a reviewed public account without moderation.",
      }),
    );
    await assertSucceeds(
      updateDoc(doc(as("reporter"), "stolenReports", "report"), {
        status: "recovered",
        updatedAt: Date.now(),
      }),
    );
  });
  it("keeps private tips from other visitors", async () => {
    await assertSucceeds(
      setDoc(doc(as("buyer"), "stolenReports", "public", "tips", "tip"), {
        senderId: "buyer",
        text: "Private information for the owner.",
        createdAt: Date.now(),
      }),
    );
    await assertFails(
      getDoc(doc(as("attacker"), "stolenReports", "public", "tips", "tip")),
    );
    await assertSucceeds(
      getDoc(doc(as("reporter"), "stolenReports", "public", "tips", "tip")),
    );
  });
});

describe("member reputation permissions", () => {
  const feedback = (overrides = {}) => ({
    authorId: "buyer",
    authorName: "Test member",
    subjectId: "seller",
    listingId: "item",
    listingTitle: "Review test listing",
    conversationId: "review-conversation",
    role: "buyer",
    authorMessageId: "buyer-message",
    subjectMessageId: "seller-message",
    rating: 5,
    body: "Helpful member and a clear, friendly marketplace experience.",
    response: "",
    status: "published",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  });
  beforeAll(async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.firestore();
      await setDoc(doc(db, "profiles", "seller"), {
        displayName: "Seller",
        bio: "",
        city: "",
        country: "ZA",
        sellerType: "private",
        createdAt: Date.now(),
      });
      await setDoc(doc(db, "conversations", "review-conversation"), {
        participants: ["buyer", "seller"],
        buyerId: "buyer",
        sellerId: "seller",
        listingId: "item",
        listingTitle: "Review test listing",
      });
      await setDoc(
        doc(
          db,
          "conversations",
          "review-conversation",
          "messages",
          "buyer-message",
        ),
        { senderId: "buyer", text: "Interested", createdAt: Date.now() },
      );
      await setDoc(
        doc(
          db,
          "conversations",
          "review-conversation",
          "messages",
          "seller-message",
        ),
        { senderId: "seller", text: "Available", createdAt: Date.now() },
      );
    });
  });
  it("rejects self reviews, invalid stars, and forged message evidence", async () => {
    const db = env.authenticatedContext("buyer").firestore();
    await assertFails(
      setDoc(
        doc(db, "profiles", "buyer", "reviews", "buyer"),
        feedback({ subjectId: "buyer" }),
      ),
    );
    await assertFails(
      setDoc(
        doc(db, "profiles", "seller", "reviews", "buyer"),
        feedback({ rating: 6 }),
      ),
    );
    await assertFails(
      setDoc(
        doc(db, "profiles", "seller", "reviews", "buyer"),
        feedback({ rating: 2.5 }),
      ),
    );
    await assertFails(
      setDoc(
        doc(db, "profiles", "seller", "reviews", "buyer"),
        feedback({ subjectMessageId: "buyer-message" }),
      ),
    );
    await assertFails(
      setDoc(
        doc(db, "profiles", "seller", "reviews", "buyer"),
        feedback({ authorName: "Impersonated member" }),
      ),
    );
    await assertFails(
      setDoc(
        doc(db, "profiles", "seller", "reviews", "buyer"),
        feedback({ body: "Too short" }),
      ),
    );
  });
  it("allows an eligible review, enforces author identity, and allows replies without rating changes", async () => {
    const db = env.authenticatedContext("buyer").firestore(),
      ref = doc(db, "profiles", "seller", "reviews", "buyer");
    await assertSucceeds(setDoc(ref, feedback()));
    await assertFails(
      setDoc(
        doc(db, "profiles", "seller", "reviews", "someone-else"),
        feedback(),
      ),
    );
    await assertSucceeds(
      getDoc(
        doc(
          env.unauthenticatedContext().firestore(),
          "profiles",
          "seller",
          "reviews",
          "buyer",
        ),
      ),
    );
    await assertSucceeds(
      updateDoc(ref, {
        rating: 4,
        body: "Updated review with additional helpful details about the member.",
        updatedAt: serverTimestamp(),
      }),
    );
    const seller = doc(
      env.authenticatedContext("seller").firestore(),
      "profiles",
      "seller",
      "reviews",
      "buyer",
    );
    await assertFails(
      updateDoc(seller, { rating: 5, updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(
      updateDoc(seller, {
        response: "Thanks for the feedback.",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(ref, {
        response: "Forged profile response",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(ref, { status: "hidden", updatedAt: serverTimestamp() }),
    );
    await assertFails(deleteDoc(ref));
  });
  it("supports seller feedback and sends reported reviews to a protected moderation queue", async () => {
    const seller = env.authenticatedContext("seller").firestore();
    await assertSucceeds(
      setDoc(
        doc(seller, "profiles", "buyer", "reviews", "seller"),
        feedback({
          authorId: "seller",
          authorName: "Seller",
          subjectId: "buyer",
          role: "seller",
          authorMessageId: "seller-message",
          subjectMessageId: "buyer-message",
        }),
      ),
    );
    const report = {
      targetId: "seller",
      replyId: "buyer",
      reporterId: "seller",
      reason: "Please investigate this feedback for accuracy.",
      status: "open",
      createdAt: Date.now(),
    };
    await assertSucceeds(
      setDoc(doc(seller, "reviewFlags", "review-flag"), report),
    );
    await assertFails(
      getDoc(
        doc(
          env.unauthenticatedContext().firestore(),
          "reviewFlags",
          "review-flag",
        ),
      ),
    );
    await assertSucceeds(
      getDoc(
        doc(
          env.authenticatedContext("mod", { moderator: true }).firestore(),
          "reviewFlags",
          "review-flag",
        ),
      ),
    );
    await assertFails(
      updateDoc(doc(seller, "reviewFlags", "review-flag"), {
        status: "reviewed",
      }),
    );
    await assertSucceeds(
      updateDoc(
        doc(
          env.authenticatedContext("mod", { moderator: true }).firestore(),
          "reviewFlags",
          "review-flag",
        ),
        { status: "reviewed" },
      ),
    );
  });
  it("lets moderators hide a review, excludes public access, and prevents author republishing", async () => {
    const path = ["profiles", "seller", "reviews", "buyer"];
    await assertSucceeds(
      updateDoc(
        doc(
          env.authenticatedContext("mod", { moderator: true }).firestore(),
          path[0],
          ...path.slice(1),
        ),
        { status: "hidden", updatedAt: Date.now() },
      ),
    );
    await assertFails(
      getDoc(
        doc(
          env.unauthenticatedContext().firestore(),
          path[0],
          ...path.slice(1),
        ),
      ),
    );
    const author = doc(
      env.authenticatedContext("buyer").firestore(),
      path[0],
      ...path.slice(1),
    );
    await assertSucceeds(getDoc(author));
    await assertFails(
      updateDoc(author, { status: "published", updatedAt: serverTimestamp() }),
    );
  });
  it("rejects feedback from a suspended author", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), "profiles", "suspended-reviewer"), {
        displayName: "Suspended reviewer",
      });
      await setDoc(doc(c.firestore(), "restrictions", "suspended-reviewer"), {
        suspended: true,
      });
    });
    const db = env.authenticatedContext("suspended-reviewer").firestore();
    await assertFails(
      setDoc(
        doc(db, "profiles", "seller", "reviews", "suspended-reviewer"),
        feedback({ authorId: "suspended-reviewer" }),
      ),
    );
  });
});

describe("new motorcycle category permissions", () => {
  it("accepts pit and kids bike drafts and protects legacy public history from direct client rewrites", async () => {
    const { categoryFields } = await import("../src/lib/taxonomy");
    const seller = env.authenticatedContext("seller").firestore();
    for (const [index, category] of [
      "motorcycles/pit-bikes",
      "motorcycles/kids-bikes",
    ].entries()) {
      const id = `new-bike-category-${index}`;
      await assertSucceeds(
        setDoc(doc(seller, "listings", id), {
          ...listing("seller", id),
          status: "draft",
          ...categoryFields(category),
        }),
      );
    }
    const legacy = {
      ...listing("seller", "legacy-vintage"),
      year: 1985,
      categoryId: "motorcycles/vintage/vintage-off-road-bikes",
      primaryCategoryId: "motorcycles",
      subcategory: "Vintage Off-Road Bikes",
      categoryAncestorIds: ["motorcycles", "motorcycles/vintage"],
      categoryPath: {
        l0: "motorcycles",
        l1: "motorcycles/vintage",
        l2: "motorcycles/vintage/vintage-off-road-bikes",
      },
    };
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), "listings", "legacy-vintage"), legacy);
    });
    await assertSucceeds(
      getDoc(
        doc(
          env.unauthenticatedContext().firestore(),
          "listings",
          "legacy-vintage",
        ),
      ),
    );
    await assertFails(
      updateDoc(doc(seller, "listings", "legacy-vintage"), {
        ...categoryFields(legacy.categoryId),
        status: "sold",
        updatedAt: Date.now(),
      }),
    );
  });
});

describe("jobs, entries and services permissions", () => {
  const post = (overrides = {}) => ({
    kind: "job",
    title: "Motorcycle workshop mechanic",
    body: "We need an experienced mechanic for a busy local workshop.",
    category: "Workshop & mechanics",
    organisation: "Test workshop",
    region: "ZA-GP",
    city: "Pretoria",
    contactEmail: "jobs@example.test",
    price: 0,
    ownerId: "buyer",
    country: "ZA",
    status: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });
  it("requires sign-in, valid categories and moderation before publication", async () => {
    const db = env.authenticatedContext("buyer").firestore();
    await assertFails(
      setDoc(
        doc(env.unauthenticatedContext().firestore(), "directoryPosts", "anon"),
        post(),
      ),
    );
    await assertFails(
      setDoc(
        doc(db, "directoryPosts", "self-published"),
        post({ status: "published" }),
      ),
    );
    await assertFails(
      setDoc(
        doc(db, "directoryPosts", "wrong-category"),
        post({ category: "Race entries" }),
      ),
    );
    await assertFails(
      setDoc(doc(db, "directoryPosts", "foreign"), post({ country: "GB" })),
    );
    await assertSucceeds(
      setDoc(doc(db, "directoryPosts", "job-pending"), post()),
    );
    await assertFails(
      getDoc(
        doc(
          env.unauthenticatedContext().firestore(),
          "directoryPosts",
          "job-pending",
        ),
      ),
    );
    await assertFails(
      getDoc(
        doc(
          env.authenticatedContext("seller").firestore(),
          "directoryPosts",
          "job-pending",
        ),
      ),
    );
    await assertSucceeds(getDoc(doc(db, "directoryPosts", "job-pending")));
  });
  it("allows moderator approval and takes owner edits back through approval", async () => {
    const mod = env
      .authenticatedContext("moderator", { moderator: true })
      .firestore();
    await assertSucceeds(
      updateDoc(doc(mod, "directoryPosts", "job-pending"), {
        status: "published",
        updatedAt: Date.now(),
      }),
    );
    await assertSucceeds(
      getDoc(
        doc(
          env.unauthenticatedContext().firestore(),
          "directoryPosts",
          "job-pending",
        ),
      ),
    );
    const owner = env.authenticatedContext("buyer").firestore();
    await assertFails(
      updateDoc(doc(owner, "directoryPosts", "job-pending"), {
        body: "Unapproved replacement text that is not allowed while published.",
        updatedAt: Date.now(),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(owner, "directoryPosts", "job-pending"), {
        status: "pending",
        body: "Updated workshop details sent back through the approval queue.",
        updatedAt: Date.now(),
      }),
    );
    await assertFails(
      updateDoc(doc(owner, "directoryPosts", "job-pending"), {
        ownerId: "seller",
        status: "pending",
        updatedAt: Date.now(),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(owner, "directoryPosts", "job-pending"), {
        status: "archived",
        updatedAt: Date.now(),
      }),
    );
  });
  it("accepts service and entry categories and protects notification state", async () => {
    const db = env.authenticatedContext("buyer").firestore();
    await assertSucceeds(
      setDoc(
        doc(db, "directoryPosts", "service-pending"),
        post({ kind: "service", category: "Other services" }),
      ),
    );
    await assertSucceeds(
      setDoc(
        doc(db, "directoryPosts", "entry-pending"),
        post({ kind: "entry", category: "Race entries" }),
      ),
    );
    await assertFails(
      setDoc(doc(db, "users", "seller", "preferences", "notifications"), {
        lastReadAt: Date.now(),
      }),
    );
    await assertFails(
      setDoc(doc(db, "users", "buyer", "preferences", "notifications"), {
        lastReadAt: Date.now(),
      }),
    );
  });
});

describe("cloud launch privilege boundaries", () => {
  it("preserves profile membership dates and rejects role fields on otherwise valid profiles", async () => {
    const db = env.authenticatedContext("new-profile-owner").firestore();
    const profile = {
      displayName: "Real member",
      bio: "",
      city: "",
      country: "ZA",
      sellerType: "private",
      createdAt: Date.now(),
    };
    await assertFails(
      setDoc(doc(db, "profiles", "new-profile-owner"), {
        ...profile,
        admin: true,
      }),
    );
    await assertFails(
      setDoc(doc(db, "profiles", "new-profile-owner"), {
        ...profile,
        moderator: true,
      }),
    );
    await assertFails(
      setDoc(doc(db, "profiles", "new-profile-owner"), {
        ...profile,
        createdAt: 0,
      }),
    );
    await assertSucceeds(
      setDoc(doc(db, "profiles", "new-profile-owner"), profile),
    );
    await assertFails(
      updateDoc(doc(db, "profiles", "new-profile-owner"), { createdAt: 0 }),
    );
    await assertFails(
      updateDoc(doc(db, "profiles", "new-profile-owner"), { admin: true }),
    );
    await assertFails(
      setDoc(doc(db, "restrictions", "other-user"), {
        suspended: true,
        actorId: "new-profile-owner",
        reason: "Unauthorized",
        updatedAt: Date.now(),
      }),
    );
    await assertFails(
      setDoc(doc(db, "events", "unapproved-event"), {
        ownerId: "new-profile-owner",
        status: "published",
      }),
    );
  });
});

describe("public rider follow graph", () => {
  // RulesTestContext provides the compat wrapper; modular SDK operations unwrap it.
  const follow = (
    db: ReturnType<typeof as>,
    from: string,
    to: string,
    value: boolean,
  ) =>
    setFollowing(
      db as unknown as import("firebase/firestore").Firestore,
      from,
      to,
      value,
    );
  const profile = {
    displayName: "Test rider",
    bio: "",
    city: "Cape Town",
    region: "ZA-WC",
    country: "ZA",
    sellerType: "private",
    createdAt: Date.now(),
  };
  beforeAll(async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      for (const uid of ["follow-alice", "follow-bob", "follow-charlie"])
        await setDoc(doc(c.firestore(), "profiles", uid), profile);
    });
  });
  it("creates both directions atomically, permits public reads and makes repeat follow/unfollow idempotent", async () => {
    const alice = as("follow-alice");
    await follow(alice, "follow-alice", "follow-bob", true);
    await follow(alice, "follow-alice", "follow-bob", true);
    const publicDb = env.unauthenticatedContext().firestore();
    await assertSucceeds(
      getDoc(
        doc(publicDb, "profiles", "follow-alice", "following", "follow-bob"),
      ),
    );
    await assertSucceeds(
      getDoc(
        doc(publicDb, "profiles", "follow-bob", "followers", "follow-alice"),
      ),
    );
    expect(
      (
        await getCountFromServer(
          collection(publicDb, "profiles", "follow-bob", "followers"),
        )
      ).data().count,
    ).toBe(1);
    expect(
      (
        await getCountFromServer(
          collection(publicDb, "profiles", "follow-alice", "following"),
        )
      ).data().count,
    ).toBe(1);
    await assertFails(
      updateDoc(
        doc(alice, "profiles", "follow-alice", "following", "follow-bob"),
        { createdAt: serverTimestamp() },
      ),
    );
    await assertFails(
      updateDoc(doc(alice, "profiles", "follow-alice"), { followerCount: 999 }),
    );
    await assertFails(
      follow(as("follow-charlie"), "follow-alice", "follow-bob", false),
    );
    await follow(alice, "follow-alice", "follow-bob", false);
    await follow(alice, "follow-alice", "follow-bob", false);
    const a = await getDoc(
      doc(publicDb, "profiles", "follow-alice", "following", "follow-bob"),
    );
    const b = await getDoc(
      doc(publicDb, "profiles", "follow-bob", "followers", "follow-alice"),
    );
    if (a.exists() || b.exists())
      throw Error("Unfollow did not remove both edges.");
  });
  it("blocks unsigned follows, other actors, missing profiles and self-follows", async () => {
    await assertFails(
      follow(
        env.unauthenticatedContext().firestore(),
        "follow-alice",
        "follow-bob",
        true,
      ),
    );
    await assertFails(
      follow(as("follow-bob"), "follow-alice", "follow-charlie", true),
    );
    await assertFails(
      follow(as("follow-alice"), "follow-alice", "missing-profile", true),
    );
    const db = as("follow-alice"),
      batch = writeBatch(db);
    batch.set(
      doc(db, "profiles", "follow-alice", "following", "follow-alice"),
      { createdAt: serverTimestamp() },
    );
    batch.set(
      doc(db, "profiles", "follow-alice", "followers", "follow-alice"),
      { createdAt: serverTimestamp() },
    );
    await assertFails(batch.commit());
  });
  it("blocks one-sided edges, forged dates and extra private/role fields", async () => {
    const db = as("follow-alice");
    await assertFails(
      setDoc(
        doc(db, "profiles", "follow-alice", "following", "follow-charlie"),
        { createdAt: serverTimestamp() },
      ),
    );
    for (const value of [
      { createdAt: Timestamp.fromMillis(1) },
      { createdAt: serverTimestamp(), admin: true },
      { createdAt: serverTimestamp(), email: "private@example.test" },
    ]) {
      const batch = writeBatch(db);
      batch.set(
        doc(db, "profiles", "follow-alice", "following", "follow-charlie"),
        value,
      );
      batch.set(
        doc(db, "profiles", "follow-charlie", "followers", "follow-alice"),
        value,
      );
      await assertFails(batch.commit());
    }
    await follow(db, "follow-alice", "follow-charlie", true);
    await assertFails(
      deleteDoc(
        doc(db, "profiles", "follow-alice", "following", "follow-charlie"),
      ),
    );
    await follow(db, "follow-alice", "follow-charlie", false);
  });
  it("allows safe public profile photos while rejecting scripts and private fields", async () => {
    const db = as("follow-alice");
    await assertSucceeds(
      updateDoc(doc(db, "profiles", "follow-alice"), {
        photoURL: "https://example.test/avatar.png",
      }),
    );
    await assertFails(
      updateDoc(doc(db, "profiles", "follow-alice"), {
        photoURL: "javascript:alert(1)",
      }),
    );
    await assertFails(
      updateDoc(doc(db, "profiles", "follow-alice"), {
        email: "private@example.test",
      }),
    );
  });
});
