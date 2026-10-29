import { z } from "zod";
export const supportCategories = [
  "Account & Login",
  "Listings & Uploads",
  "Payments & Promotions",
  "Messages & Communication",
  "Technical Problems",
  "Safety, Fraud & Suspicious Activity",
  "Business Accounts & Advertising",
  "General Questions",
  "Other",
] as const;
export const supportStatuses = [
  "new",
  "waiting-staff",
  "waiting-customer",
  "resolved",
] as const;
export const supportInput = z
  .object({
    action: z.enum(["create", "reply", "note", "status", "priority", "read"]),
    id: z
      .string()
      .regex(/^TH-[A-F0-9]{24}$/)
      .optional(),
    category: z.enum(supportCategories).optional(),
    subject: z.string().trim().min(3).max(160).optional(),
    text: z.string().trim().min(1).max(6000).optional(),
    status: z.enum(supportStatuses).optional(),
    priority: z.enum(["normal", "high"]).optional(),
    listingRef: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,128}$/)
      .optional(),
    orderRef: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,128}$/)
      .optional(),
  })
  .strict();
export type SupportActor = { uid: string; admin: boolean; guest?: boolean };
