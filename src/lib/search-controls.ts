import { motorcycleCatalogue } from "./marketplace";
import { categoryById } from "./taxonomy";
import type { Filters } from "./search-contract";

export const alphabeticalMakes = Object.keys(motorcycleCatalogue).sort((a, b) =>
  a.localeCompare(b, "en-ZA"),
);
export const suggestedItemBrands = [
  "Alpinestars",
  "Arai",
  "Bell",
  "Brembo",
  "DID",
  "Fox",
  "Garmin",
  "Leatt",
  "Motul",
  "Oakley",
  "Oxford",
  "Renthal",
  "Shoei",
  "Thor",
].sort((a, b) => a.localeCompare(b, "en-ZA"));
export function chooseSearchCategory(
  filters: Filters,
  category: string,
): Filters {
  const next = { ...filters, category };
  const type = categoryById[category]?.itemType;
  if (type && !["motorcycle", "part"].includes(type)) {
    for (const key of [
      "make",
      "model",
      "year",
      "yearFrom",
      "yearTo",
      "engineType",
      "displacement",
      "maxHours",
      "fuelSystem",
      "origin",
      "vintage",
    ] as const)
      next[key] = "";
  }
  if (type === "motorcycle") {
    next.brand = "";
    next.origin = "";
  }
  if (type === "part") next.maxHours = "";
  const engines = categoryById[category]?.engineTypes;
  if (engines?.length && next.engineType && !engines.includes(next.engineType))
    next.engineType = "";
  if (type && type !== "gear") {
    next.size = "";
    next.sizeSystem = "";
  }
  return next;
}
