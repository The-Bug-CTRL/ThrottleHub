import { it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AccountTypePicker,
  BusinessProfileFields,
} from "../src/components/seller-account-fields";
import { RunningVideoPlayer } from "../src/components/running-video-player";
import { emptyBusiness } from "../src/lib/seller-account";
import { categoryById } from "../src/lib/taxonomy";
it("offers Personal and Business accounts with a self-declared business explanation", () => {
  const html = renderToStaticMarkup(
    <AccountTypePicker value="business" onChange={() => {}} />,
  );
  expect(html).toContain("Personal account");
  expect(html).toContain("Business account");
  expect(html).toContain("does not grant verification");
  expect(html).toContain("checked");
});
it("labels business contacts private by default and requires a business name", () => {
  const html = renderToStaticMarkup(
    <BusinessProfileFields value={emptyBusiness} onChange={() => {}} />,
  );
  expect(html).toContain("Business name");
  expect(html).toContain("required");
  expect(html).toContain("Business email (private by default)");
  expect(html).toContain("Operating hours");
});
it("does not attach or preload video bytes before a buyer chooses playback", () => {
  const html = renderToStaticMarkup(
    <RunningVideoPlayer
      listingId="item"
      available={true}
      poster="/photo.jpg"
    />,
  );
  expect(html).toContain("Watch running video");
  expect(html).not.toContain("<video");
  expect(html).not.toContain("/api/listings/item/video");
});
it("uses explicit motorcycle item-type identifiers for every active motorcycle branch", () => {
  const bikes = Object.values(categoryById).filter(
    (c) => c.isActive && c.itemType === "motorcycle",
  );
  expect(bikes.length).toBeGreaterThan(10);
  for (const id of [
    "motorcycles/motocross",
    "motorcycles/enduro",
    "motorcycles/trials",
    "motorcycles/pit-bikes",
    "motorcycles/kids-bikes",
  ])
    expect(categoryById[id].itemType).toBe("motorcycle");
  for (const id of ["parts", "riding-gear", "electronics", "tools"])
    expect(categoryById[id].itemType).not.toBe("motorcycle");
});
