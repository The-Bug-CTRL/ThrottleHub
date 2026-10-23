import { describe, expect, it } from "vitest";
import {
  taxonomy,
  categoryById,
  categoryChildren,
  categoryFields,
  categoryPath,
  legacyCategory,
} from "../src/lib/taxonomy";
import {
  defaultFilters,
  filtersFromParams,
  filtersUrl,
  matchesListing,
  validateFilters,
} from "../src/lib/search-contract";
import { listingSchema, parseListingDraft } from "../src/lib/models";
import { listing } from "./fixtures";
import { NextRequest } from "next/server";
import { middleware } from "../src/middleware";
describe("V2 category and listing contracts", () => {
  it("returns a real HTTP 404 before invalid category routes can stream", async () => {
    expect(
      (
        await middleware(
          new NextRequest("http://localhost/marketplace/not-a-category"),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await middleware(
          new NextRequest(
            "http://localhost/marketplace/parts/engine/top-end/cylinder-heads",
          ),
        )
      ).status,
    ).toBe(200);
  });
  it("has six roots, unique stable paths, valid parents and at most four levels", () => {
    expect(categoryChildren()).toHaveLength(6);
    expect(new Set(taxonomy.map((c) => c.id)).size).toBe(taxonomy.length);
    for (const c of taxonomy) {
      expect(c.level).toBeLessThanOrEqual(3);
      expect(categoryPath(c.id).length).toBe(c.level + 1);
      if (c.parentId) expect(categoryById[c.parentId]).toBeDefined();
      expect(categoryFields(c.id).categoryPath[`l${c.level}`]).toBe(c.id);
    }
  });
  it("navigates technical paths and filters engine-specific components", () => {
    expect(
      categoryPath("parts/engine/top-end/cylinder-heads").map((c) => c.name),
    ).toEqual(["Parts & Spares", "Engine", "Top End", "Cylinder Heads"]);
    expect(
      categoryChildren("parts/engine/top-end", "two-stroke").map((c) => c.name),
    ).not.toContain("Camshafts");
    expect(
      categoryChildren("parts/engine/top-end", "four-stroke").map(
        (c) => c.name,
      ),
    ).not.toContain("Power Valves / Power Valve Components");
    expect(legacyCategory("Parts", "Top-end components")).toBe(
      "parts/engine/top-end",
    );
  });
  it("rejects foreign markets, invalid provinces, forged categories and mismatched models", () => {
    for (const changes of [
      { country: "GB" },
      { currency: "USD" },
      { region: "London" },
      { categoryId: "invented" },
      { model: "YZ250" },
      { category: "Accessories" },
    ])
      expect(
        listingSchema.safeParse({ ...listing(), ...changes }).success,
      ).toBe(false);
    expect(listingSchema.safeParse({ ...listing(), year: 0 }).success).toBe(
      true,
    );
  });
  it("validates electronics without motorcycle fields and unknown fitment", () => {
    const watch = {
      ...listing(),
      ...categoryFields("electronics/watches-wearables/gps-watches"),
      make: "",
      model: "",
      year: 0,
    };
    expect(listingSchema.safeParse(watch).success).toBe(true);
    expect(listingSchema.safeParse({ ...watch, make: "Honda" }).success).toBe(
      false,
    );
    const part = {
      ...listing(),
      ...categoryFields("parts/exhaust/two-stroke-expansion-chambers"),
      details: { ...listing().details, engineType: "four-stroke" },
    };
    expect(listingSchema.safeParse(part).success).toBe(false);
  });
  it("saves incomplete drafts without inventing a town or province", () => {
    const input = {
      ...listing(),
      title: "",
      description: "",
      price: 0,
      city: "",
      region: "",
    };
    const draft = parseListingDraft(input);
    expect(draft.success).toBe(true);
    if (draft.success) expect(draft.data.region).toBe("");
    expect(listingSchema.safeParse(input).success).toBe(false);
  });
});
describe("V2 query predicates and saved criteria", () => {
  const part = {
    ...listing(),
    ...categoryFields("parts/engine/top-end/cylinder-heads"),
    make: "Yamaha",
    model: "YZ250",
    year: 0,
    region: "ZA-GP",
    details: {
      ...listing().details,
      yearFrom: 2003,
      yearTo: 2007,
      engineType: "two-stroke" as const,
      displacement: 250,
    },
  };
  it("includes descendants, excludes sibling leaves and combines fitment filters", () => {
    expect(
      matchesListing(part, {
        ...defaultFilters,
        category: "parts/engine",
        make: "Yamaha",
        model: "YZ250",
        year: "2005",
        engineType: "two-stroke",
        displacement: "250",
        region: "ZA-GP",
      }),
    ).toBe(true);
    expect(
      matchesListing(part, {
        ...defaultFilters,
        category: "parts/engine/top-end/pistons",
      }),
    ).toBe(false);
    expect(matchesListing(part, { ...defaultFilters, year: "1995" })).toBe(
      false,
    );
    expect(
      matchesListing(part, {
        ...defaultFilters,
        yearFrom: "2006",
        yearTo: "2010",
      }),
    ).toBe(true);
    expect(
      matchesListing(
        { ...part, details: { ...part.details, yearFrom: 0, yearTo: 0 } },
        { ...defaultFilters, year: "2005" },
      ),
    ).toBe(false);
  });
  it("supports gear sizes, electronics, normalized towns and prices", () => {
    const boots = {
      ...listing(),
      ...categoryFields("riding-gear/boots/motocross-boots"),
      make: "",
      model: "",
      year: 0,
      details: { ...listing().details, size: "11", sizeSystem: "UK" as const },
      city: "Cape Town",
      condition: "Used" as const,
    };
    expect(
      matchesListing(boots, {
        ...defaultFilters,
        category: "riding-gear/boots",
        size: "11",
        sizeSystem: "UK",
        condition: "Used",
        city: "cape town",
        min: "50",
        max: "200",
      }),
    ).toBe(true);
    expect(matchesListing(boots, { ...defaultFilters, sizeSystem: "US" })).toBe(
      false,
    );
    const watch = {
      ...boots,
      ...categoryFields("electronics/watches-wearables/gps-watches"),
    };
    expect(
      matchesListing(watch, { ...defaultFilters, category: "electronics" }),
    ).toBe(true);
    expect(
      matchesListing({ ...part, country: "GB" as "ZA" }, defaultFilters),
    ).toBe(false);
  });
  it("round trips all saved URL criteria and normalizes legacy links", () => {
    const f = {
      ...defaultFilters,
      category: "parts/engine",
      make: "Yamaha",
      model: "YZ250",
      yearFrom: "1995",
      region: "ZA-GP",
      min: "100",
      sort: "price-asc",
    };
    expect(
      filtersFromParams(
        new URL(filtersUrl(f), "http://localhost").searchParams,
      ),
    ).toEqual(f);
    expect(
      filtersFromParams(
        new URLSearchParams(
          "category=Parts&subcategory=Top-end+components&country=global",
        ),
      ).category,
    ).toBe("parts/engine/top-end");
  });
  it("rejects unsupported text and invalid ranges without dropping criteria", () => {
    expect(() =>
      validateFilters({ ...defaultFilters, term: "Yamaha YZ250" }),
    ).toThrow("one keyword");
    expect(() =>
      validateFilters({ ...defaultFilters, min: "200", max: "100" }),
    ).toThrow();
    expect(() =>
      validateFilters({
        ...defaultFilters,
        category: "electronics",
        engineType: "two-stroke",
      }),
    ).toThrow();
    expect(() =>
      validateFilters({ ...defaultFilters, country: "global" }),
    ).toThrow();
  });
});
