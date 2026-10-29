import { z } from "zod";
import { categoryById, categoryFields } from "./taxonomy";
import { motorcycleCatalogue, provinces } from "./marketplace";
import { validDelivery } from "./listing-guidance";
const listingBaseSchema = z.object({
  title: z.string().min(8).max(100),
  description: z.string().min(20).max(5000),
  category: z.string(),
  categoryId: z
    .string()
    .refine(
      (v) => Boolean(categoryById[v]?.isActive),
      "Choose an active category",
    ),
  subcategory: z.string().min(1).max(80),
  make: z.string().max(40),
  model: z.string().max(80),
  year: z.coerce
    .number()
    .int()
    .refine(
      (v) => v === 0 || (v >= 1950 && v <= 2028),
      "Use a year from 1950–2028, or 0 for unknown",
    ),
  price: z.coerce.number().positive().max(10000000),
  currency: z.literal("ZAR"),
  country: z.literal("ZA"),
  region: z
    .string()
    .refine((v) => v in provinces, "Choose a South African province"),
  city: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(
      /^[\p{L}\p{N} .’'()\-]+$/u,
      "Use a town or city name, not an address",
    ),
  condition: z.enum(["New", "Excellent", "Good", "Used"]),
  shipping: z.enum(["Collection only", "Domestic shipping"]),
  deliveryMethods: z.array(z.string().max(40)).max(8).optional(),
  specs: z.string().max(1500),
  details: z
    .object({
      engineType: z.enum(["", "two-stroke", "four-stroke"]).default(""),
      displacement: z.coerce.number().min(0).max(2000).default(0),
      hours: z.coerce.number().min(0).max(100000).default(0),
      yearFrom: z.coerce
        .number()
        .int()
        .refine((v) => v === 0 || (v >= 1950 && v <= 2028))
        .default(0),
      yearTo: z.coerce
        .number()
        .int()
        .refine((v) => v === 0 || (v >= 1950 && v <= 2028))
        .default(0),
      fuelSystem: z.enum(["", "carburettor", "fuel-injection"]).default(""),
      origin: z.enum(["", "OEM", "aftermarket"]).default(""),
      partNumber: z.string().max(100).default(""),
      brand: z.string().max(80).default(""),
      size: z.string().max(40).default(""),
      sizeSystem: z.enum(["", "UK", "US", "EU", "alpha", "cm"]).default(""),
      sellerType: z.enum(["private", "dealer"]).default("private"),
      vintage: z.boolean().default(false),
    })
    .default({}),
});
function validateListingValues(
  v: z.infer<typeof listingBaseSchema>,
  ctx: z.RefinementCtx,
) {
  const c = categoryById[v.categoryId];
  if (!c) return;
  if (v.deliveryMethods !== undefined && !validDelivery(v.categoryId, v.deliveryMethods))
    ctx.addIssue({ code: "custom", path: ["deliveryMethods"], message: "Choose delivery methods appropriate for this category." });
  const expected = categoryFields(c.id);
  if (
    v.category !== expected.category ||
    v.subcategory !== expected.subcategory
  )
    ctx.addIssue({
      code: "custom",
      path: ["categoryId"],
      message: "Category labels must match the selected category",
    });
  if (v.model && (!v.make || !motorcycleCatalogue[v.make]?.includes(v.model)))
    ctx.addIssue({
      code: "custom",
      path: ["model"],
      message: "Choose a model associated with this make, or leave unknown",
    });
  if (v.make && !motorcycleCatalogue[v.make])
    ctx.addIssue({
      code: "custom",
      path: ["make"],
      message: "Choose a supported make, or leave unknown",
    });
  if (
    v.details.yearFrom &&
    v.details.yearTo &&
    v.details.yearFrom > v.details.yearTo
  )
    ctx.addIssue({
      code: "custom",
      path: ["details"],
      message: "Compatibility end year must follow start year",
    });
  if (
    c.engineTypes &&
    v.details.engineType &&
    !c.engineTypes.includes(v.details.engineType)
  )
    ctx.addIssue({
      code: "custom",
      path: ["details"],
      message: "This component does not apply to the selected engine type",
    });
  if (
    !["motorcycle", "part"].includes(c.itemType) &&
    (v.make ||
      v.model ||
      v.year ||
      v.details.engineType ||
      v.details.displacement ||
      v.details.yearFrom ||
      v.details.yearTo ||
      v.details.origin ||
      v.details.partNumber ||
      v.details.fuelSystem ||
      v.details.hours)
  )
    ctx.addIssue({
      code: "custom",
      path: ["details"],
      message: "Engine and fitment fields do not apply to this category",
    });
}
export const listingSchema = listingBaseSchema.superRefine(
  validateListingValues,
);
export type ListingInput = z.infer<typeof listingSchema>;
export const detailLabels: Record<string, string> = {
  engineType: "Engine type",
  displacement: "Engine size (cc)",
  hours: "Engine hours",
  yearFrom: "Compatible from year",
  yearTo: "Compatible to year",
  fuelSystem: "Fuel system",
  origin: "Part origin",
  partNumber: "Manufacturer part number",
  brand: "Item brand",
  size: "Size",
  sizeSystem: "Size system",
  sellerType: "Seller type (self-declared)",
  vintage: "Vintage",
};
export function displayDetails(details?: ListingInput["details"]) {
  return Object.entries(details || {})
    .filter(([, v]) => Boolean(v))
    .map(
      ([key, value]) =>
        [
          detailLabels[key] || key,
          key === "sellerType"
            ? value === "dealer"
              ? "Business Seller"
              : "Private Seller"
            : value === true
              ? "Yes"
              : String(value).replaceAll("-", " "),
        ] as [string, string],
    );
}
// Drafts may be unfinished, but still obey country, category and technical contracts.
const listingDraftSchema = listingBaseSchema
  .extend({
    title: z.string().max(100),
    description: z.string().max(5000),
    price: z.coerce.number().min(0).max(10000000),
    city: z.string().trim().max(80),
    region: z
      .string()
      .refine((v) => !v || v in provinces, "Choose a South African province"),
  })
  .superRefine(validateListingValues);
export const parseListingDraft = (value: ListingInput) =>
  listingDraftSchema.safeParse(value);
export type Listing = ListingInput & {
  promotion?: { featured: boolean; test: boolean; expiresAt: number };
  sellerAccountType?: "personal" | "business";
  runningVideoId?: string;
  runningVideo?: import("./running-video").RunningVideo | null;
  id: string;
  ownerId: string;
  slug: string;
  images: string[];
  status:
    | "draft"
    | "published"
    | "sold"
    | "expired"
    | "on-hold"
    | "hidden"
    | "rejected"
    | "removed";
  publishedAt?: number;
  soldAt?: number;
  expiredAt?: number;
  lastStatusChangeAt?: number;
  originalAskingPrice?: number;
  sellerAnonymised?: boolean;
  createdAt: number;
  updatedAt: number;
  searchTokens: string[];
  primaryCategoryId: string;
  categoryAncestorIds: string[];
  categoryPath: Record<string, string>;
};
export function tokens(text: string) {
  return [
    ...new Set(
      text
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9 ]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .flatMap((w) =>
          Array.from({ length: Math.min(w.length, 20) }, (_, i) =>
            w.slice(0, i + 1),
          ),
        ),
    ),
  ].slice(0, 350);
}
export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
export function money(l: Pick<Listing, "price" | "currency">) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: l.currency,
    maximumFractionDigits: 0,
  }).format(l.price);
}
