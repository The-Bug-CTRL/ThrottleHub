import { it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MarketplaceFilterFields } from "../src/components/marketplace-filter-fields";
import { MarketplaceFiltersDialog } from "../src/components/marketplace-filters-dialog";
import {
  defaultFilters,
  filtersUrl,
  filtersFromParams,
  validateFilters,
} from "../src/lib/search-contract";
const selected = {
  ...defaultFilters,
  category: "motorcycles/motocross",
  make: "Yamaha",
  engineType: "two-stroke",
  model: "YZ250",
  region: "ZA-WC",
  min: "10000",
  max: "50000",
};
it("uses the same populated fields for modal and sidebar, including price, engine, model and province", () => {
  const fields = renderToStaticMarkup(
    <MarketplaceFilterFields filters={selected} onChange={() => {}} />,
  );
  const modal = renderToStaticMarkup(
    <MarketplaceFiltersDialog
      filters={selected}
      onChange={() => {}}
      onApply={() => {}}
      onClose={() => {}}
    />,
  );
  expect(modal).toContain(fields);
  for (const value of ["Yamaha", "two-stroke", "YZ250", "ZA-WC"])
    expect(fields).toContain(`value="${value}" selected=""`);
  expect(fields).toContain('value="10000"');
  expect(fields).toContain('value="50000"');
  expect(modal).toContain("Close filters");
  expect(modal).toContain("Apply filters &amp; search");
  expect(fields).not.toContain('<option value="YZ250F"');
  expect(
    filtersFromParams(
      new URLSearchParams(filtersUrl(validateFilters(selected)).split("?")[1]),
    ),
  ).toEqual(selected);
});
it("keeps gear-specific filters available without motorcycle controls", () => {
  const html = renderToStaticMarkup(
    <MarketplaceFilterFields
      filters={{
        ...defaultFilters,
        category: "riding-gear",
        brand: "Leatt",
        size: "M",
        sizeSystem: "alpha",
      }}
      onChange={() => {}}
    />,
  );
  expect(html).toContain("Brand (optional)");
  expect(html).toContain('value="Leatt"');
  expect(html).toContain("Sizing");
  expect(html).not.toContain("Max riding hours");
});
