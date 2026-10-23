import { describe, it, expect } from "vitest";
import { reviewSchema, reviewSummary } from "../src/lib/reviews";
describe("member review data", () => {
  it("validates ratings and meaningful written feedback", () => {
    expect(
      reviewSchema.safeParse({
        rating: 5,
        body: "A helpful member and a very smooth transaction.",
      }).success,
    ).toBe(true);
    for (const rating of [0, 6, 2.5, NaN])
      expect(
        reviewSchema.safeParse({
          rating,
          body: "A helpful member and a very smooth transaction.",
        }).success,
      ).toBe(false);
    expect(
      reviewSchema.safeParse({ rating: 5, body: "                    " })
        .success,
    ).toBe(false);
  });
  it("calculates a weighted rating with no invented score for new profiles", () => {
    expect(reviewSummary([0, 0, 0, 0, 0])).toEqual({
      count: 0,
      average: 0,
      distribution: [0, 0, 0, 0, 0],
    });
    expect(reviewSummary([1, 0, 0, 1, 2])).toEqual({
      count: 4,
      average: 3.75,
      distribution: [1, 0, 0, 1, 2],
    });
  });
});
