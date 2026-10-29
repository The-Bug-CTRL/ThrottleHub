import { categoryFields } from "../src/lib/taxonomy";
import { listingSchema } from "../src/lib/models";
import { Listing, tokens } from "../src/lib/models";
export const testProject = "demo-throttlehub-tests";
export function listing(ownerId = "seller", id = "item"): Listing {
  return {
    id,
    ownerId,
    title: "Permission test motorcycle",
    description:
      "Temporary record created only by the isolated automated test runner.",
    ...categoryFields("motorcycles/enduro"),
    details: listingSchema._def.schema.shape.details.parse({}),
    make: "Honda",
    model: "CR125",
    year: 2024,
    price: 100,
    country: "ZA",
    region: "ZA-GP",
    city: "Test City",
    currency: "ZAR",
    condition: "Good",
    shipping: "Collection only",
    deliveryMethods: ["collect"],
    specs: "Temporary test specifications",
    slug: "permission-test-motorcycle",
    images: ["/no-photo.svg"],
    status: "published",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    searchTokens: tokens("Permission test motorcycle"),
  };
}
export function thread(ownerId = "writer") {
  const now = Date.now();
  return {
    ownerId,
    authorName: "Test member",
    title: "Temporary technical question",
    body: "A temporary topic used exclusively for automated security testing.",
    category: "technical",
    slug: "temporary-technical-question",
    status: "published",
    locked: false,
    createdAt: now,
    updatedAt: now,
    lastReplyAt: now,
    searchTokens: tokens("Temporary technical question"),
  };
}
export function article(ownerId = "editor") {
  const now = Date.now();
  return {
    ownerId,
    title: "Temporary editorial permission test",
    body: "This is temporary editorial content used exclusively by the isolated automated test runner.",
    summary: "Temporary automated test content.",
    category: "Maintenance & Technical",
    authorName: "Test editor",
    coverImage: "",
    caption: "",
    status: "draft",
    slug: "temporary-editorial-permission-test",
    createdAt: now,
    updatedAt: now,
    publishedAt: 0,
    searchTokens: tokens("Temporary editorial permission test"),
  };
}
export function stolen(ownerId = "reporter") {
  const now = Date.now();
  return {
    ownerId,
    make: "Test Make",
    model: "Test Model",
    year: 2024,
    colour: "Test colour",
    features: "Temporary test record",
    stolenDate: "2026-01-01",
    country: "ZA",
    region: "ZA-GP",
    city: "Test City",
    description: "Temporary report used only for automated permission testing.",
    images: [],
    status: "pending",
    createdAt: now,
    updatedAt: now,
    searchTokens: tokens("Test Make Test Model"),
  };
}
