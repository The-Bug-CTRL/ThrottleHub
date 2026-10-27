import { z } from "zod";
export type AccountType = "personal" | "business";
export const businessCategories = [
  "Motorcycle dealership",
  "Parts retailer",
  "Riding equipment retailer",
  "Workshop",
  "Professional trader",
  "Other business",
] as const;
export const businessSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    logoURL: z
      .string()
      .max(2048)
      .refine((v) => !v || /^https:\/\/[^ ]+$/.test(v)),
    description: z.string().max(2000),
    category: z.enum(businessCategories),
    website: z
      .string()
      .max(500)
      .refine((v) => !v || /^https:\/\/[^ ]+$/.test(v)),
    phone: z.string().max(40),
    email: z.union([z.literal(""), z.string().email().max(254)]),
    hours: z.string().max(500),
  })
  .strict();
export const emptyBusiness = {
  name: "",
  logoURL: "",
  description: "",
  category: "Other business" as (typeof businessCategories)[number],
  website: "",
  phone: "",
  email: "",
  hours: "",
};
export const accountTypeOf = (profile?: {
  accountType?: unknown;
  sellerType?: unknown;
}): AccountType =>
  profile?.accountType === "business" ||
  (!profile?.accountType && profile?.sellerType === "dealer")
    ? "business"
    : "personal";
export const sellerLabel = (type?: string) =>
  type === "business" || type === "dealer"
    ? "Business Seller"
    : "Private Seller";
