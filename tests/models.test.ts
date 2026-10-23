import { describe, it, expect } from "vitest";
import { listingSchema, tokens, slugify } from "../src/lib/models";
import {
  threadSchema,
  articleSchema,
  stolenSchema,
  eventSchema,
  evidenceSchema,
} from "../src/lib/community-models";
import { listing, thread, article, stolen } from "./fixtures";
describe("Shared web / Flutter data contracts", () => {
  it("validates a temporary listing and rejects invalid prices/currencies", () => {
    expect(listingSchema.safeParse(listing()).success).toBe(true);
    expect(listingSchema.safeParse({ ...listing(), price: -1 }).success).toBe(
      false,
    );
    expect(
      listingSchema.safeParse({ ...listing(), currency: "EUR" }).success,
    ).toBe(false);
  });
  it("bounds indexed prefixes and stable slugs", () => {
    expect(tokens("Honda CR125")).toContain("cr12");
    expect(tokens("x ".repeat(10000)).length).toBeLessThanOrEqual(350);
    expect(slugify("A Technical Question!")).toBe("a-technical-question");
  });
  it("validates controlled forum categories and content lengths", () => {
    expect(threadSchema.safeParse(thread()).success).toBe(true);
    expect(
      threadSchema.safeParse({ ...thread(), category: "arbitrary" }).success,
    ).toBe(false);
    expect(threadSchema.safeParse({ ...thread(), body: "x" }).success).toBe(
      false,
    );
  });
  it("validates genuine editorial fields without HTML execution", () => {
    expect(articleSchema.safeParse(article()).success).toBe(true);
    expect(
      articleSchema.safeParse({ ...article(), category: "invented" }).success,
    ).toBe(false);
  });
  it("keeps stolen public and private contracts distinct", () => {
    expect(
      stolenSchema.parse({ ...stolen(), policeCase: "private" }),
    ).not.toHaveProperty("policeCase");
    expect(
      evidenceSchema.safeParse({
        policeCase: "",
        frameId: "",
        engineId: "",
        note: "",
        paths: [],
      }).success,
    ).toBe(true);
    expect(
      stolenSchema.safeParse({ ...stolen(), stolenDate: "2099-01-01" }).success,
    ).toBe(false);
  });
  it("rejects unsafe event links and inverted times", () => {
    const e = {
      title: "Temporary event test",
      body: "This is temporary test event detail text.",
      type: "Enduro",
      startsAt: 100,
      endsAt: 200,
      country: "ZA",
      region: "ZA-GP",
      city: "Test City",
      venue: "",
      organizer: "Test organizer",
      link: "https://example.test",
    };
    expect(eventSchema.safeParse(e).success).toBe(true);
    expect(
      eventSchema.safeParse({ ...e, link: "javascript:alert(1)" }).success,
    ).toBe(false);
    expect(eventSchema.safeParse({ ...e, endsAt: 50 }).success).toBe(false);
  });
});
