import { expect, it } from "vitest";
import {
  requiresRunningVideo,
  taxonomy,
  retiredCategoryAliases,
} from "../src/lib/taxonomy";
it("requires running footage for every actual motorcycle category, not fitment or engine parts", () => {
  for (const category of taxonomy) {
    expect(requiresRunningVideo(category.id), category.id).toBe(
      category.itemType === "motorcycle",
    );
    if (category.id.startsWith("parts/"))
      expect(requiresRunningVideo(category.id)).toBe(false);
  }
  for (const [old, current] of Object.entries(retiredCategoryAliases))
    expect(requiresRunningVideo(old)).toBe(requiresRunningVideo(current));
  expect(requiresRunningVideo("invalid/motorcycles")).toBe(false);
});
