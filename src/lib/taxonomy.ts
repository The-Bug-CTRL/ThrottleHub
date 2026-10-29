export type ItemType =
  "motorcycle" | "part" | "gear" | "electronics" | "equipment" | "tool";
export interface Category {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  ancestorIds: string[];
  level: number;
  sortOrder: number;
  isActive: boolean;
  itemType: ItemType;
  filterSchema: ItemType;
  engineTypes?: string[];
}
import catalogue from "./category-catalogue.json";
// Retired grouping aliases keep old bookmarks, saved searches and listing edits usable.
export const retiredCategoryAliases: Record<string, string> = {
  "motorcycles/vintage": "motorcycles",
  "motorcycles/vintage/vintage-off-road-bikes": "motorcycles",
  "motorcycles/vintage/restoration-projects": "motorcycles",
  "motorcycles/vintage/non-running-spares-or-repair": "motorcycles",
  "motorcycles/motocross/vintage-motocross": "motorcycles/motocross",
  "motorcycles/trials/classic-vintage-trials": "motorcycles/trials",
};
export const resolveCategoryId = (id: string) =>
  Object.hasOwn(retiredCategoryAliases, id) ? retiredCategoryAliases[id] : id;
export const taxonomy: Category[] = catalogue as Category[];
export const categoryById = Object.fromEntries(taxonomy.map((c) => [c.id, c]));
/** Actual vehicles only; engine/fitment selections never turn a part into a bike. */
export function requiresRunningVideo(categoryId: string): boolean {
  return categoryById[resolveCategoryId(categoryId)]?.itemType === "motorcycle";
}
export const categoryChildren = (id: string | null = null, engineType = "") =>
  taxonomy.filter(
    (c) =>
      c.isActive &&
      c.parentId === id &&
      (!engineType || !c.engineTypes || c.engineTypes.includes(engineType)),
  );
export const categoryPath = (id: string) => {
  const resolved = resolveCategoryId(id);
  return categoryById[resolved]
    ? [...categoryById[resolved].ancestorIds, resolved].map(
        (key) => categoryById[key],
      )
    : [];
};
export const categoryHref = (id: string) =>
  `/marketplace/${resolveCategoryId(id)}`;
export function categoryFields(id: string) {
  id = resolveCategoryId(id);
  const path = categoryPath(id);
  if (!path.length || path.some((c) => !c.isActive))
    throw new Error("Choose an active category");
  return {
    categoryId: id,
    primaryCategoryId: path[0].id,
    categoryAncestorIds: path.slice(0, -1).map((c) => c.id),
    categoryPath: Object.fromEntries(path.map((c, i) => [`l${i}`, c.id])),
    category: path[0].name,
    subcategory: path.at(-1)!.name,
  };
}
export function legacyCategory(category: string, subcategory = "") {
  if (category === "Motorcycles" && /vintage|classic/i.test(subcategory))
    return "motorcycles";
  if (category === "Accessories" && subcategory === "Tools") return "tools";
  const root =
    (
      {
        Parts: "parts",
        "Riding Gear": "riding-gear",
        Accessories: "accessories",
        Motorcycles: "motorcycles",
      } as Record<string, string>
    )[category] ||
    taxonomy.find((c) => !c.parentId && c.name === category)?.id ||
    "";
  const aliases: Record<string, string> = {
    "Trail / Off-road": "trail",

    Engines: "complete-engines",
    "Top-end components": "engine/top-end",
    "Bottom-end components": "engine/bottom-end",
    "Exhaust systems": "exhaust",
    Wheels: "wheels-tyres",
    Plastics: "bodywork",
    Frames: "frame-controls",
    Electronics: "electrical",
    Controls: "frame-controls",
    Tools: "tools",
    Transport: "transport",
  };
  const candidate = aliases[subcategory]
    ? `${root}/${aliases[subcategory]}`
    : taxonomy.find(
        (c) =>
          c.ancestorIds.includes(root) &&
          c.name.toLowerCase() === subcategory.toLowerCase(),
      )?.id;
  return candidate && categoryById[candidate] ? candidate : root;
}
