import { provinces } from "./marketplace";
import { z } from "zod";
export const forumCategories = {
  general: [
    "General Dirt Bike Discussion",
    "Introduce yourself, ask questions and share the ride.",
  ],
  motocross: ["Motocross", "Track days, setup and life behind the gate."],
  enduro: [
    "Enduro & Trail Riding",
    "Singletrack, hard enduro and weekend escapes.",
  ],
  technical: [
    "Technical Help & Repairs",
    "Diagnose problems and share workshop knowledge.",
  ],
  builds: [
    "Bike Builds & Restorations",
    "Document the project, from frame to first ride.",
  ],
  racing: [
    "Racing & Events",
    "Race preparation, results and club conversations.",
  ],
  trails: [
    "Riding Locations & Trails",
    "Responsible access and places to ride.",
  ],
  gear: ["Gear & Equipment", "Protection, kit and equipment advice."],
  trading: ["Buying & Selling Advice", "Inspection advice and safer trading."],
  vintage: ["Vintage Motorcycles", "Keep the classics running."],
} as const;
export const newsCategories = [
  "Motocross News",
  "Enduro News",
  "Racing",
  "New Motorcycles",
  "Product Reviews",
  "Riding Gear",
  "Maintenance & Technical",
  "Industry News",
  "Community Stories",
] as const;
export const eventTypes = [
  "Motocross",
  "Enduro",
  "Trail ride",
  "Club event",
  "Training",
  "Community ride",
] as const;
const country = z.literal("ZA");
export const threadSchema = z.object({
  title: z.string().trim().min(8).max(140),
  body: z.string().trim().min(20).max(12000),
  category: z
    .string()
    .refine((v) => v in forumCategories, "Choose a forum category"),
});
export const replySchema = z.object({
  body: z.string().trim().min(2).max(6000),
});
export const articleSchema = z.object({
  title: z.string().trim().min(8).max(160),
  body: z.string().trim().min(40).max(50000),
  category: z.enum(newsCategories),
  summary: z.string().trim().min(20).max(350),
  authorName: z.string().trim().min(2).max(80),
  caption: z.string().max(300),
  coverImage: z.string().max(2000),
});
export const stolenSchema = z.object({
  make: z.string().trim().min(2).max(40),
  model: z.string().trim().min(1).max(80),
  year: z.coerce.number().int().min(1950).max(2028),
  colour: z.string().trim().min(2).max(60),
  features: z.string().trim().max(1500),
  stolenDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date")
    .refine(
      (v) =>
        !Number.isNaN(Date.parse(v)) &&
        v <= new Date().toISOString().slice(0, 10),
      "Date cannot be in the future",
    ),
  country,
  region: z
    .string()
    .refine((v) => v in provinces, "Choose a South African province"),
  city: z.string().trim().min(2).max(80),
  description: z.string().trim().min(20).max(3000),
});
export const evidenceSchema = z.object({
  policeCase: z.string().max(120),
  frameId: z.string().max(120),
  engineId: z.string().max(120),
  note: z.string().max(1500),
  paths: z.array(z.string().max(400)).max(4),
});
export const eventSchema = z
  .object({
    title: z.string().trim().min(8).max(140),
    body: z.string().trim().min(20).max(8000),
    type: z.enum(eventTypes),
    startsAt: z.coerce.number().positive(),
    endsAt: z.coerce.number().positive(),
    country,
    region: z
      .string()
      .refine((v) => v in provinces, "Choose a South African province"),
    city: z.string().min(2).max(80),
    venue: z.string().max(160),
    organizer: z.string().min(2).max(120),
    link: z
      .string()
      .max(500)
      .refine(
        (v) => !v || /^https:\/\//.test(v),
        "Use an https:// organizer link",
      ),
  })
  .refine((v) => v.endsAt >= v.startsAt, "Event end must follow start");
export interface Thread {
  id: string;
  title: string;
  body: string;
  category: string;
  ownerId: string;
  authorName: string;
  status: "published" | "hidden" | "deleted";
  locked: boolean;
  createdAt: number;
  updatedAt: number;
  lastReplyAt: number;
  searchTokens: string[];
}
export interface Reply {
  id: string;
  body: string;
  ownerId: string;
  authorName: string;
  status: "published" | "hidden" | "deleted";
  createdAt: number;
  updatedAt: number;
}
export type Article = z.infer<typeof articleSchema> & {
  id: string;
  ownerId: string;
  slug: string;
  status: "draft" | "published";
  createdAt: number;
  updatedAt: number;
  publishedAt: number;
  searchTokens: string[];
};
export type StolenReport = z.infer<typeof stolenSchema> & {
  id: string;
  ownerId: string;
  images: string[];
  status: "pending" | "published" | "recovered" | "rejected" | "archived";
  createdAt: number;
  updatedAt: number;
  searchTokens: string[];
};
export type Event = z.infer<typeof eventSchema> & {
  id: string;
  ownerId: string;
  status: "draft" | "published";
  createdAt: number;
  updatedAt: number;
};
