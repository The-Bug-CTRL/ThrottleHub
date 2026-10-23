import { it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { chooseSearchCategory } from "../src/lib/search-controls";
import {
  defaultFilters,
  validateFilters,
  filtersUrl,
  filtersFromParams,
} from "../src/lib/search-contract";
vi.mock("next/navigation", () => ({
  usePathname: () => "/browse",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () =>
    new URLSearchParams(
      "make=Yamaha&category=parts%2Fengine%2Fbottom-end%2Fmain-bearings&region=ZA-WC&max=5000",
    ),
}));
import { MarketplaceSearchBar } from "../src/components/marketplace-search-bar";
import { SearchDraftProvider } from "../src/components/search-draft";
import { MemberAvatar } from "../src/components/member-avatar";

it("clears incompatible engine filters when switching to gear while retaining budget and location", () => {
  const next = chooseSearchCategory(
    {
      ...defaultFilters,
      make: "Yamaha",
      model: "YZ125",
      year: "2020",
      engineType: "two-stroke",
      displacement: "125",
      fuelSystem: "carburettor",
      maxHours: "100",
      region: "ZA-WC",
      min: "100",
      max: "5000",
    },
    "riding-gear",
  );
  expect(next.make).toBe("");
  expect(next.model).toBe("");
  expect(next.engineType).toBe("");
  expect(next.year).toBe("");
  expect(next.region).toBe("ZA-WC");
  expect(next.max).toBe("5000");
  expect(() => validateFilters(next)).not.toThrow();
});
it("retains compatible motorcycle filters and preserves the existing URL search contract", () => {
  const next = chooseSearchCategory(
    {
      ...defaultFilters,
      make: "Yamaha",
      model: "YZ125",
      region: "ZA-GP",
      max: "40000",
      engineType: "four-stroke",
    },
    "motorcycles/motocross/two-stroke-motocross",
  );
  expect(next.engineType).toBe("");
  expect(next.make).toBe("Yamaha");
  expect(next.model).toBe("YZ125");
  expect(
    filtersFromParams(new URLSearchParams(filtersUrl(next).split("?")[1])),
  ).toEqual(next);
  expect(() => validateFilters(next)).not.toThrow();
});
it("renders alphabetical brands, the extensive category path and selected province from a shared search URL", () => {
  const html = renderToStaticMarkup(
    <SearchDraftProvider>
      <MarketplaceSearchBar />
    </SearchDraftProvider>,
  );
  expect(html.indexOf('value="Beta"')).toBeLessThan(
    html.indexOf('value="Honda"'),
  );
  expect(html.indexOf('value="Honda"')).toBeLessThan(
    html.indexOf('value="Yamaha"'),
  );
  expect(html).toContain('value="Yamaha" selected=""');
  expect(html).toContain('value="ZA-WC" selected=""');
  expect(html).toContain("Main Bearings");
  expect(html).toContain("Narrow your category");
  expect(html).toContain("Use this category");
});
it("uses the real account photo where available and readable initials otherwise", () => {
  const photo = renderToStaticMarkup(
    <MemberAvatar
      user={{
        displayName: "Sam Rider",
        photoURL: "https://lh3.googleusercontent.com/example",
      }}
    />,
  );
  expect(photo).toContain("https://lh3.googleusercontent.com/example");
  const fallback = renderToStaticMarkup(
    <MemberAvatar user={{ displayName: "Sam Rider", photoURL: null }} />,
  );
  expect(fallback).toContain("SR");
  expect(fallback).not.toContain("<img");
});
