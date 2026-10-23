import { z } from "zod";
import { provinces } from "./marketplace";
export const directoryCategories = {
  job: [
    "Workshop & mechanics",
    "Sales & retail",
    "Riding & coaching",
    "Events & operations",
    "Marketing & admin",
    "Other jobs",
  ],
  entry: [
    "Race entries",
    "Trail ride entries",
    "Club events",
    "Training days",
    "Other entries",
  ],
  service: [
    "Repairs & servicing",
    "Suspension & tuning",
    "Bike transport",
    "Training & coaching",
    "Rentals & tours",
    "Accommodation",
    "Other services",
  ],
} as const;
export type DirectoryKind = keyof typeof directoryCategories;
export const directoryLabels: Record<DirectoryKind, string> = {
  job: "Jobs",
  entry: "Entries",
  service: "Services",
};
export const directorySchema = z
  .object({
    kind: z.enum(["job", "entry", "service"]),
    title: z.string().trim().min(8).max(140),
    body: z.string().trim().min(20).max(6000),
    category: z.string(),
    organisation: z.string().trim().max(120),
    region: z
      .string()
      .refine((value) => value in provinces, "Choose a province."),
    city: z.string().trim().min(2).max(80),
    contactEmail: z.string().trim().email().max(254),
    price: z.coerce.number().finite().min(0).max(10000000),
  })
  .superRefine((value, context) => {
    if (
      !(directoryCategories[value.kind] as readonly string[]).includes(
        value.category,
      )
    )
      context.addIssue({
        code: "custom",
        path: ["category"],
        message: "Choose a category for this type of post.",
      });
  });
export type DirectoryInput = z.infer<typeof directorySchema>;
export type DirectoryPost = DirectoryInput & {
  id: string;
  ownerId: string;
  country: "ZA";
  status: "pending" | "published" | "rejected" | "archived";
  createdAt: number;
  updatedAt: number;
};
