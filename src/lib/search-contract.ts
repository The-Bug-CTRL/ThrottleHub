import { z } from "zod";
import { categoryById, legacyCategory, resolveCategoryId } from "./taxonomy";
import { provinceCode } from "./marketplace";
import type { Listing } from "./models";
export const defaultFilters = {
  country: "ZA",
  category: "",
  term: "",
  make: "",
  model: "",
  year: "",
  yearFrom: "",
  yearTo: "",
  region: "",
  city: "",
  condition: "",
  shipping: "",
  min: "",
  max: "",
  sort: "newest",
  engineType: "",
  displacement: "",
  maxHours: "",
  fuelSystem: "",
  origin: "",
  brand: "",
  size: "",
  sizeSystem: "",
  sellerType: "",
  vintage: "",
};
export type Filters = typeof defaultFilters;
export interface SearchCursor {
  value: number;
  id: string;
  fingerprint: string;
}
export function filtersFromParams(
  params: Pick<URLSearchParams, "get">,
  categoryId = "",
): Filters {
  const f = { ...defaultFilters };
  for (const key of Object.keys(f) as (keyof Filters)[])
    f[key] = params.get(key === "term" ? "q" : key) || f[key];
  f.country = "ZA";
  f.category = resolveCategoryId(f.category);
  f.category =
    resolveCategoryId(categoryId) ||
    (categoryById[f.category]
      ? f.category
      : legacyCategory(f.category, params.get("subcategory") || "") ||
        f.category);
  f.region = provinceCode(f.region) || f.region;
  return f;
}
export function filtersUrl(f: Filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(f))
    if (value && value !== defaultFilters[key as keyof Filters])
      params.set(key === "term" ? "q" : key, value);
  return `/browse${params.size ? `?${params}` : ""}`;
}
export function validateFilters(input: unknown): Filters {
  const f = z
    .object(
      Object.fromEntries(
        Object.keys(defaultFilters).map((k) => [k, z.string().max(100)]),
      ),
    )
    .strict()
    .parse(input) as Filters;
  f.category = resolveCategoryId(f.category);
  if (f.country !== "ZA")
    throw Error("The active marketplace is South Africa only.");
  if (f.category && !categoryById[f.category]?.isActive)
    throw Error("Choose an active category.");
  if (!["newest", "oldest", "price-asc", "price-desc"].includes(f.sort))
    throw Error("Choose a supported sort.");
  if (f.region && !provinceCode(f.region))
    throw Error("Choose a South African province.");
  f.term = f.term.trim().replace(/\s+/g, " ");
  if (
    f.term &&
    !/^[a-z0-9]{1,20}(?:[\s-]+[a-z0-9]{1,20}){0,5}$/i.test(f.term.trim())
  )
    throw Error("Use up to six short search words, such as Yamaha YZ250.");
  for (const key of [
    "year",
    "yearFrom",
    "yearTo",
    "min",
    "max",
    "displacement",
    "maxHours",
  ] as const)
    if (
      f[key] &&
      (!/^\d+(\.\d+)?$/.test(f[key]) || !Number.isFinite(Number(f[key])))
    )
      throw Error(`Invalid ${key} filter.`);
  if (f.min && f.max && +f.min > +f.max)
    throw Error("Minimum price exceeds maximum price.");
  if (
    f.year &&
    (!Number.isInteger(+f.year) ||
      (+f.year !== 0 && (+f.year < 1950 || +f.year > 2028)))
  )
    throw Error("Invalid model year.");
  for (const k of ["yearFrom", "yearTo"] as const)
    if (f[k] && (!Number.isInteger(+f[k]) || +f[k] < 1950 || +f[k] > 2028))
      throw Error("Invalid year range.");
  if (f.yearFrom && f.yearTo && +f.yearFrom > +f.yearTo)
    throw Error("Start year exceeds end year.");
  const type = categoryById[f.category]?.itemType;
  if (
    type &&
    !["motorcycle", "part"].includes(type) &&
    [
      f.make,
      f.model,
      f.year,
      f.yearFrom,
      f.yearTo,
      f.engineType,
      f.displacement,
      f.maxHours,
      f.fuelSystem,
      f.origin,
      f.vintage,
    ].some(Boolean)
  )
    throw Error(
      "Engine and compatibility filters do not apply to this category. Clear them first.",
    );
  return f;
}
const same = (a: unknown, b: string) =>
  String(a || "")
    .toLocaleLowerCase("en-ZA")
    .trim() === b.toLocaleLowerCase("en-ZA").trim();
export function matchesListing(l: Listing, f: Filters) {
  if (l.country !== "ZA" || l.currency !== "ZAR" || l.status !== "published")
    return false;
  if (
    f.category &&
    l.categoryId !== f.category &&
    !l.categoryAncestorIds?.includes(f.category)
  )
    return false;
  for (const key of ["make", "model", "condition", "shipping", "city"] as const)
    if (f[key] && !same(l[key], f[key])) return false;
  if (f.region && provinceCode(l.region) !== provinceCode(f.region))
    return false;
  if (
    f.term &&
    !searchWords(f.term).every((word) => l.searchTokens.includes(word))
  )
    return false;
  if ((f.min && l.price < +f.min) || (f.max && l.price > +f.max)) return false;
  const d = l.details;
  const from = l.primaryCategoryId === "parts" ? d?.yearFrom || l.year : l.year;
  const to =
    l.primaryCategoryId === "parts"
      ? d?.yearTo || d?.yearFrom || l.year
      : l.year;
  if (f.year === "0" && (from || to)) return false;
  if (
    f.year &&
    f.year !== "0" &&
    (!from || !to || +f.year < from || +f.year > to)
  )
    return false;
  if (
    (f.yearFrom && (!to || to < +f.yearFrom)) ||
    (f.yearTo && (!from || from > +f.yearTo))
  )
    return false;
  for (const key of [
    "engineType",
    "fuelSystem",
    "origin",
    "brand",
    "size",
    "sizeSystem",
    "sellerType",
  ] as const)
    if (f[key] && !same(d?.[key], f[key])) return false;
  if (f.displacement && d?.displacement !== +f.displacement) return false;
  if (f.maxHours && (!d?.hours || d.hours > +f.maxHours)) return false;
  if (f.vintage && !d?.vintage) return false;
  return true;
}
export function searchWords(term: string) {
  return term
    .trim()
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean);
}
