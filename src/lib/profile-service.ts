import type { Firestore } from "firebase-admin/firestore";
import { z } from "zod";
import { businessSchema } from "./seller-account";
import { ListingError } from "./listing-lifecycle";
import { provinces } from "./marketplace";
function profileIdentity(uid: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(uid))
    throw new ListingError("Invalid account identity.", 403);
}
const https = z
  .string()
  .max(2048)
  .refine((v) => !v || /^https:\/\/[^ ]+$/.test(v));
export const profileSetupSchema = z
  .object({
    accountType: z.enum(["personal", "business"]).optional(),
    business: businessSchema.optional(),
    displayName: z.string().trim().min(2).max(80).optional(),
    photoURL: https.optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.accountType === "business" && !v.business)
      ctx.addIssue({
        code: "custom",
        message: "Enter your business details.",
        path: ["business"],
      });
    if (v.accountType !== "business" && v.business)
      ctx.addIssue({
        code: "custom",
        message: "Business details require a Business account.",
        path: ["business"],
      });
  });
export const profileEditSchema = z
  .object({
    accountType: z.enum(["personal", "business"]),
    business: businessSchema.optional(),
    displayName: z.string().trim().min(2).max(80),
    photoURL: https,
    bio: z.string().max(600),
    city: z.string().max(80),
    region: z.string().refine((v) => !v || Object.hasOwn(provinces, v)),
    country: z.enum(["ZA", "GB", "US", "AU"]),
    contactPhonePublic: z.boolean().default(false),
    businessContactsPublic: z.boolean().default(false),
    contactPhone: z
      .string()
      .max(40)
      .regex(/^[+0-9 ()-]*$/),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.accountType === "business" && !v.business)
      ctx.addIssue({
        code: "custom",
        message: "Enter your business details.",
        path: ["business"],
      });
    if (v.accountType !== "business" && v.business)
      ctx.addIssue({
        code: "custom",
        message: "Business details require a Business account.",
        path: ["business"],
      });
  });
export function publicProfile(data: Record<string, unknown>) {
  const safe = { ...data };
  if (safe.contactPhonePublic !== true) delete safe.contactPhone;
  if (safe.business && typeof safe.business === "object")
    safe.business = {
      ...Object.fromEntries(Object.entries(safe.business).filter(([key]) =>
        ["name", "logoURL", "description", "category", "website", "phone", "email", "hours"].includes(key))),
      ...(safe.businessContactsPublic === true ? {} : { phone: "", email: "" }),
    };
  data = safe;
  return Object.fromEntries(
    [
      "displayName",
      "bio",
      "city",
      "region",
      "country",
      "sellerType",
      "createdAt",
      "updatedAt",
      "photoURL",
      "accountType",
      "business",
      "contactPhone",
      "contactPhonePublic",
      "businessContactsPublic",
    ]
      .filter((k) => data[k] !== undefined)
      .map((k) => [k, data[k]]),
  );
}
export async function ensureProfile(
  db: Firestore,
  uid: string,
  input: unknown,
) {
  profileIdentity(uid);
  const value = profileSetupSchema.parse(input);
  return db.runTransaction(async (tx) => {
    const ref = db.doc(`profiles/${uid}`),
      existing = await tx.get(ref);
    const contacts = (await tx.get(db.doc(`profileContacts/${uid}`))).data();
    if (existing.exists)
      return {
        needsSetup: false,
        created: false,
        profile: ownerProfile(existing.data()!, contacts),
      };
    if (!value.accountType)
      return { needsSetup: true, created: false, profile: null };
    const now = Date.now(),
      profile = {
        displayName: value.displayName || "Rider",
        bio: "",
        city: "",
        country: "ZA",
        sellerType: value.accountType === "business" ? "dealer" : "private",
        accountType: value.accountType,
        ...(value.accountType === "business"
          ? { business: value.business }
          : {}),
        ...(value.photoURL ? { photoURL: value.photoURL } : {}),
        createdAt: now,
        updatedAt: now,
      };
    const privateContacts = {
      contactPhone: "",
      businessPhone: value.business?.phone || "",
      businessEmail: value.business?.email || "",
    };
    const published = publicProfile(profile);
    tx.create(ref, published);
    tx.set(db.doc(`profileContacts/${uid}`), privateContacts);
    return {
      needsSetup: false,
      created: true,
      profile: ownerProfile(published, privateContacts),
    };
  });
}
export async function editProfile(db: Firestore, uid: string, input: unknown) {
  profileIdentity(uid);
  const value = profileEditSchema.parse(input);
  return db.runTransaction(async (tx) => {
    const ref = db.doc(`profiles/${uid}`),
      existing = await tx.get(ref);
    if (!existing.exists)
      throw new ListingError("Finish setting up your account first.", 409);
    const data = {
      ...existing.data(),
      ...value,
      sellerType: value.accountType === "business" ? "dealer" : "private",
      updatedAt: Date.now(),
    };
    if (value.accountType === "personal") delete data.business;
    const privateContacts = {
      contactPhone: value.contactPhone,
      businessPhone: value.business?.phone || "",
      businessEmail: value.business?.email || "",
    };
    // Retain unrelated trusted metadata; change only the explicit contact projection.
    const published: Record<string, unknown> = {
      ...data,
      ...publicProfile(data),
    };
    if (!value.contactPhonePublic) delete published.contactPhone;
    tx.set(ref, published);
    tx.set(db.doc(`profileContacts/${uid}`), privateContacts);
    return { profile: ownerProfile(published, privateContacts) };
  });
}

function ownerProfile(
  data: Record<string, unknown>,
  contacts?: Record<string, unknown>,
) {
  const business = data.business as Record<string, unknown> | undefined;
  return {
    ...publicProfile(data),
    contactPhone: contacts?.contactPhone ?? data.contactPhone ?? "",
    ...(business
      ? {
          business: {
            ...business,
            phone: contacts?.businessPhone ?? business.phone ?? "",
            email: contacts?.businessEmail ?? business.email ?? "",
          },
        }
      : {}),
  };
}
