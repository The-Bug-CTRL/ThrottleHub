import { it, expect } from "vitest";
import { publicListing } from "../src/lib/public-listing";
import { listing } from "./fixtures";
it("preserves public historic asking prices and excludes unexpected private Admin fields", () => {
  const result = publicListing(
    {
      ...listing(),
      status: "sold",
      originalAskingPrice: 200,
      soldAt: 1000,
      email: "private@example.test",
      moderationNotes: "private",
      buyerId: "private",
    },
    "item",
  );
  expect(result).toMatchObject({
    id: "item",
    status: "sold",
    originalAskingPrice: 200,
    soldAt: 1000,
    price: 100,
  });
  for (const field of ["email", "moderationNotes", "buyerId"])
    expect(result).not.toHaveProperty(field);
});
