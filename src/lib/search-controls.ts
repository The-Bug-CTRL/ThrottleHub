import { motorcycleCatalogue } from "./marketplace";
import { categoryById, categoryPath } from "./taxonomy";
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
  if (
    engines?.length &&
    next.engineType &&
    !engines.includes(next.engineType)
  ) {
    next.engineType = "";
    if (
      next.model &&
      motorcycleCatalogue[next.make]?.includes(next.model) &&
      !engines.some((engine) =>
        searchModels(next.make, engine).includes(next.model),
      )
    )
      next.model = "";
  }
  if (type && type !== "gear") {
    next.size = "";
    next.sizeSystem = "";
  }
  return next;
}
export function chooseSearchEngine(
  filters: Filters,
  engineType: string,
): Filters {
  const next = { ...filters, engineType, model: "" };
  const category = categoryById[filters.category];
  if (
    engineType &&
    category?.engineTypes?.length &&
    !category.engineTypes.includes(engineType)
  ) {
    next.category =
      [...categoryPath(filters.category)]
        .reverse()
        .find(
          (c) => !c.engineTypes?.length || c.engineTypes.includes(engineType),
        )?.id || "motorcycles";
  }
  return next;
}
/** Suggestions only: ambiguous model years remain available under either engine. */
export function searchModels(make: string, engineType = "") {
  return [...(motorcycleCatalogue[make] || [])]
    .filter((model) => {
      if (!engineType) return true;
      let engine = "";
      if (make === "Yamaha")
        engine = /^(YZ|WR|TT)/.test(model)
          ? /F|TT/.test(model)
            ? "four-stroke"
            : "two-stroke"
          : "";
      if (make === "Honda")
        engine = model.startsWith("CRF")
          ? "four-stroke"
          : model.startsWith("CR")
            ? "two-stroke"
            : "";
      if (make === "Suzuki")
        engine = /RM-Z|DR-Z/.test(model)
          ? "four-stroke"
          : model.startsWith("RM")
            ? "two-stroke"
            : "";
      if (make === "KTM")
        engine = /-F/.test(model) ? "four-stroke" : "two-stroke";
      if (make === "Husqvarna")
        engine = /^(FC|FE)/.test(model)
          ? "four-stroke"
          : /^TC/.test(model)
            ? "two-stroke"
            : "";
      if (make === "Kawasaki")
        engine = /^(KLX|KX450)|KX250F/.test(model)
          ? "four-stroke"
          : /^(KDX|KX65|KX85|KX100|KX112|KX125)/.test(model)
            ? "two-stroke"
            : "";
      return !engine || engine === engineType;
    })
    .sort((a, b) => a.localeCompare(b, "en-ZA", { numeric: true }));
}
