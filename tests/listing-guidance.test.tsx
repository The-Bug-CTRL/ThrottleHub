import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { User } from "firebase/auth";
import { listingTitleExample, deliveryOptions, compatibleDelivery, validDelivery } from "../src/lib/listing-guidance";
import { listingSchema, parseListingDraft } from "../src/lib/models";
import { categoryFields } from "../src/lib/taxonomy";
import { listing } from "./fixtures";
vi.mock("../src/components/promote-listing", () => ({ PromotionManager: ({ listingId }: { listingId: string }) => <button data-listing={listingId}>Promote Listing</button> }));
import { PostPublishOffer } from "../src/components/post-publish-offer";
describe("listing guidance", () => {
  it("selects meaningful examples through parents, leaves, aliases and fallback", () => {
    for (const [id, expected] of [["motorcycles/motocross", "YZ250"], ["motorcycles/enduro", "300 EXC"], ["riding-gear/helmets/motocross-helmets", "helmet"], ["riding-gear/boots", "Tech 7"], ["riding-gear/clothing/jerseys", "jersey"], ["parts/engine/top-end/cylinder-heads", "cylinder head"], ["parts/exhaust", "FMF"], ["parts/wheels-tyres", "21 inch"], ["electronics/gps-navigation", "Garmin"], ["accessories", "tie-down"], ["motorcycles/motocross/vintage-motocross", "YZ250"], ["unknown", "Brand"]]) expect(listingTitleExample(id)).toContain(expected);
  });
  it("filters selections without adding shipping or mutating user content", () => {
    const draft = { title: "My carefully written title", deliveryMethods: ["collect", "meet", "pudo"] };
    expect(compatibleDelivery("motorcycles", draft.deliveryMethods)).toEqual(["collect", "meet"]);
    expect(compatibleDelivery("parts", [])).toEqual([]);
    expect(draft.title).toBe("My carefully written title");
    expect(draft.deliveryMethods).toContain("pudo");
    expect(deliveryOptions("motorcycles").some(m => m.id === "postnet")).toBe(false);
    expect(validDelivery("parts", ["seller-transport"])).toBe(false);
    expect(validDelivery("parts", ["collect", "collect"])).toBe(false);
    expect(validDelivery("parts", ["pudo", "meet"])).toBe(true);
  });
  it("validates delivery against category while accepting legacy and incomplete draft data", () => {
    const bike = listing();
    expect(listingSchema.safeParse({ ...bike, deliveryMethods: ["pudo"] }).success).toBe(false);
    expect(listingSchema.safeParse({ ...bike, ...categoryFields("parts"), deliveryMethods: ["pudo"] }).success).toBe(true);
    const { deliveryMethods: ignored, ...legacy } = bike;
    void ignored;
    expect(listingSchema.safeParse(legacy).success).toBe(true);
    expect(parseListingDraft({ ...bike, deliveryMethods: [], title: "", price: 0 }).success).toBe(true);
  });
  it("offers an explicit optional promotion and a direct skip route without starting checkout", () => {
    const html = renderToStaticMarkup(<PostPublishOffer user={{ uid: "seller" } as User} listingId="owned-ad" slug="my-bike" />);
    expect(html).toContain("already published");
    expect(html).toContain('data-listing="owned-ad"');
    expect(html).toContain('href="/listing/owned-ad/my-bike"');
    expect(html).toContain("Skip for now");
    expect(html).not.toContain("checkout.paystack.com");
  });
});
