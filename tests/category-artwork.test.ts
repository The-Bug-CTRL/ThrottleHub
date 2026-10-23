import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { categoryIconFiles, categoryIconPath } from "../src/lib/category-icons";
import {
  categoryChildren,
  categoryFields,
  retiredCategoryAliases,
  taxonomy,
} from "../src/lib/taxonomy";
import {
  filtersFromParams,
  validateFilters,
  defaultFilters,
} from "../src/lib/search-contract";
import { listingSchema } from "../src/lib/models";
import { middleware } from "../src/middleware";
import { NextRequest } from "next/server";
import { listing } from "./fixtures";
describe("user category artwork and motorcycle categories", () => {
  it("uses supplied PNGs for every existing category and the motocross image for Motorcycles", () => {
    expect(categoryIconPath("motorcycles")).toBe(
      "/catagories_icons/motocrossbike_icon.png",
    );
    expect(categoryIconPath("motorcycles/trials")).toBe(
      "/catagories_icons/trialsbike_icon.png",
    );
    expect(categoryIconPath("motorcycles/pit-bikes")).toBe(
      "/catagories_icons/pitbike_icon.png",
    );
    expect(categoryIconPath("motorcycles/kids-bikes")).toBe(
      "/catagories_icons/kids_bike_icon.png",
    );
    for (const category of taxonomy) {
      const path = categoryIconPath(category.id);
      expect(path).not.toBeNull();
      expect(existsSync(`public${path}`)).toBe(true);
    }
    expect(new Set(Object.values(categoryIconFiles)).size).toBe(11);
    for (const name of Object.values(categoryIconFiles))
      expect(
        readFileSync(`public/catagories_icons/${name}`)
          .subarray(1, 4)
          .toString(),
      ).toBe("PNG");
    expect(categoryIconPath("unknown-category")).toBeNull();
  });
  it("adds pit and kids bikes while preserving youth and technical subcategories", async () => {
    const ids = categoryChildren("motorcycles").map((c) => c.id);
    expect(ids).toContain("motorcycles/pit-bikes");
    expect(ids).toContain("motorcycles/kids-bikes");
    expect(
      taxonomy.some((c) => c.id === "motorcycles/motocross/youth-motocross"),
    ).toBe(true);
    expect(
      taxonomy.some((c) => c.id === "parts/engine/top-end/cylinder-heads"),
    ).toBe(true);
    expect(
      taxonomy.some(
        (c) => c.itemType === "motorcycle" && /vintage|classic/i.test(c.name),
      ),
    ).toBe(false);
    for (const id of ["motorcycles/pit-bikes", "motorcycles/kids-bikes"]) {
      expect(
        listingSchema.safeParse({ ...listing(), ...categoryFields(id) })
          .success,
      ).toBe(true);
      expect(
        (
          await middleware(
            new NextRequest(`http://localhost/marketplace/${id}`),
          )
        ).status,
      ).toBe(200);
    }
  });
  it("keeps retired bookmarks and saved searches usable and normalizes old listings without changing their year", async () => {
    for (const [old, current] of Object.entries(retiredCategoryAliases)) {
      const response = await middleware(
        new NextRequest(`http://localhost/marketplace/${old}?region=ZA-GP`),
      );
      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe(
        `http://localhost/marketplace/${current}?region=ZA-GP`,
      );
      expect(
        filtersFromParams(new URLSearchParams({ category: old })).category,
      ).toBe(current);
      expect(
        validateFilters({ ...defaultFilters, category: old }).category,
      ).toBe(current);
      const normalized = { ...listing(), year: 1985, ...categoryFields(old) };
      expect(normalized.categoryId).toBe(current);
      expect(normalized.year).toBe(1985);
      expect(listingSchema.safeParse(normalized).success).toBe(true);
    }
  });
});
