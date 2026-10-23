import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  canTransition,
  isPublicListing,
  listingHref,
} from "../src/lib/listing-history";
import { validateListingImages } from "../src/lib/listing-lifecycle";
import { listing } from "./fixtures";

const mocks = vi.hoisted(() => ({
  getListing: vi.fn(),
  publicListings: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw Error(`308:${url}`);
  }),
  notFound: vi.fn(() => {
    throw Error("404");
  }),
}));
vi.mock("../src/lib/server", () => ({
  getListing: mocks.getListing,
  getPublicListings: mocks.publicListings,
}));
vi.mock("next/navigation", () => ({
  permanentRedirect: mocks.redirect,
  notFound: mocks.notFound,
}));
vi.mock("../src/components/detail", () => ({ ListingDetail: () => null }));
import Page, { generateMetadata } from "../src/app/listing/[id]/[slug]/page";
import { middleware } from "../src/middleware";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.publicListings.mockResolvedValue([]);
});

describe("permanent listing pages", () => {
  it("keeps public history distinct from available inventory and validates transitions", () => {
    for (const status of ["published", "sold", "expired", "on-hold"] as const)
      expect(isPublicListing({ ...listing(), status })).toBe(true);
    for (const status of ["draft", "rejected", "removed", "hidden"] as const)
      expect(isPublicListing({ ...listing(), status })).toBe(false);
    expect(canTransition("sold", "published")).toBe(false);
    expect(canTransition("published", "draft")).toBe(false);
    expect(canTransition("expired", "published")).toBe(true);
    expect(canTransition("on-hold", "published")).toBe(true);
    expect(canTransition("removed", "published", true)).toBe(false);
  });
  it("rejects foreign, arbitrary and incorrectly owned image references", () => {
    const valid = `https://firebasestorage.googleapis.com/v0/b/bucket/o/${encodeURIComponent("listing-images/seller/item/photo.jpg")}?alt=media&token=test`;
    expect(() =>
      validateListingImages([valid], "seller", "item", "bucket", false),
    ).not.toThrow();
    for (const url of [
      "https://evil.test/photo",
      valid.replace("bucket", "other"),
      valid.replace("seller", "other"),
      valid.replace("item", "other"),
    ])
      expect(() =>
        validateListingImages([url], "seller", "item", "bucket", false),
      ).toThrow();
  });
  it("redirects old titles to the canonical URL using the same ID", async () => {
    const l = { ...listing(), slug: "new-title" };
    mocks.getListing.mockResolvedValue(l);
    await expect(
      Page({ params: Promise.resolve({ id: l.id, slug: "old-title" }) }),
    ).rejects.toThrow(`308:${listingHref(l)}`);
  });
  it("renders historical metadata and accurate structured availability without indexing private records", async () => {
    for (const status of ["sold", "expired", "on-hold"] as const) {
      const l = { ...listing(), status };
      mocks.getListing.mockResolvedValue(l);
      const params = Promise.resolve({ id: l.id, slug: l.slug });
      const metadata = await generateMetadata({ params });
      expect(metadata.title).toContain(
        status === "on-hold"
          ? "On hold"
          : status === "sold"
            ? "Sold"
            : "Expired",
      );
      expect(metadata.alternates.canonical).toBe(listingHref(l));
      expect(metadata.robots).toBeUndefined();
      const page = await Page({ params });
      const json = JSON.parse(
        page.props.children[0].props.dangerouslySetInnerHTML.__html,
      );
      expect(json.offers.availability).toBe(
        `https://schema.org/${status === "sold" ? "SoldOut" : "OutOfStock"}`,
      );
      expect(json.offers.price).toBe(l.price);
    }
    mocks.getListing.mockResolvedValue(null);
    const params = Promise.resolve({ id: "private", slug: "item" });
    expect((await generateMetadata({ params })).robots).toEqual({
      index: false,
      follow: false,
    });
    await expect(Page({ params })).rejects.toThrow("404");
  });
  it("returns real 404s before streaming and canonical 308 redirects", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    try {
      fetcher.mockResolvedValue(new Response("{}", { status: 404 }));
      const removed = await middleware(
        new NextRequest("http://localhost:3000/listing/removed/old-title"),
      );
      expect(removed.status).toBe(404);
      expect(removed.headers.get("X-Robots-Tag")).toBe("noindex");
      fetcher.mockResolvedValue(
        new Response(JSON.stringify({ canonical: "/listing/item/new-title" }), {
          status: 200,
        }),
      );
      const moved = await middleware(
        new NextRequest("http://localhost:3000/listing/item/old-title"),
      );
      expect(moved.status).toBe(308);
      expect(moved.headers.get("location")).toBe(
        "http://localhost:3000/listing/item/new-title",
      );
      fetcher.mockResolvedValue(new Response("{}", { status: 503 }));
      expect(
        (
          await middleware(
            new NextRequest("http://localhost:3000/listing/item/new-title"),
          )
        ).status,
      ).toBe(503);
    } finally {
      fetcher.mockRestore();
    }
  });
});
