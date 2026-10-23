import type { Firestore } from "firebase-admin/firestore";
import { categoryFields } from "./taxonomy";
import {
  listingSchema,
  parseListingDraft,
  slugify,
  tokens,
  type ListingInput,
} from "./models";
import { canTransition } from "./listing-history";

export class ListingError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export interface ListingActor {
  uid: string;
  admin?: boolean;
  moderator?: boolean;
}
export function validateListingImages(
  images: unknown,
  uid: string,
  id: string,
  bucket: string,
  emulator: boolean,
): asserts images is string[] {
  if (!Array.isArray(images) || images.length > 8)
    throw new ListingError("Use at most eight listing photos.");
  for (const image of images) {
    if (typeof image !== "string") throw new ListingError("Invalid photo.");
    let url: URL;
    try {
      url = new URL(image);
    } catch {
      throw new ListingError("Invalid photo URL.");
    }
    const prefix = `/v0/b/${bucket}/o/`;
    const hostAllowed =
      url.origin === "https://firebasestorage.googleapis.com" ||
      (emulator && url.origin === "http://127.0.0.1:9298") ||
      (emulator && url.origin === "http://127.0.0.1:9199");
    const object = url.pathname.startsWith(prefix)
      ? decodeURIComponent(url.pathname.slice(prefix.length))
      : "";
    if (
      !hostAllowed ||
      !object.startsWith(`listing-images/${uid}/${id}/`) ||
      object.split("/").length !== 4
    )
      throw new ListingError("Photos must belong to this listing and seller.");
  }
}

// Trusted server service. Only the authenticated API may supply actor; clients cannot write history.
export async function mutateListing(
  db: Firestore,
  id: string,
  actor: ListingActor,
  input: Record<string, unknown>,
  now = Date.now(),
) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id))
    throw new ListingError("Invalid listing ID.");
  const ref = db.collection("listings").doc(id);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const old = snap.data();
    const pending = old
      ? (await tx.get(ref.collection("mediaCleanup").doc("pending"))).data()
      : undefined;
    const mediaOwner = pending?.ownerId || old?.ownerId;
    const staff = actor.admin === true || actor.moderator === true;
    if (old && old.ownerId !== actor.uid && !staff)
      throw new ListingError("This listing is not yours.", 403);
    const action = input.action;
    if (action === "cleanup" && old)
      return { status: old.status, slug: old.slug };
    if (action === "save") {
      if (old && !["draft", "published"].includes(old.status))
        throw new ListingError(
          "Historical and restricted adverts cannot be edited. Reactivate an expired or on-hold advert first.",
          409,
        );
      const status = input.status;
      if (status !== "draft" && status !== "published")
        throw new ListingError("Invalid save status.");
      if (old?.status === "published" && status === "draft")
        throw new ListingError("Use On hold to pause a published advert.");
      const parsed =
        status === "draft"
          ? parseListingDraft(input.values as ListingInput)
          : listingSchema.safeParse(input.values);
      if (!parsed.success)
        throw new ListingError(
          parsed.error.issues.map((i) => i.message).join("; "),
        );
      const v = parsed.data;
      if (
        !Array.isArray(input.images) ||
        input.images.length > 8 ||
        (status === "published" && !input.images.length)
      )
        throw new ListingError("Add a photo before publishing.");
      const firstPublish =
        status === "published" &&
        (!old || old.status === "draft") &&
        !old?.publishedAt;
      const next = {
        ...old,
        ...v,
        ...categoryFields(v.categoryId),
        id,
        ownerId: old?.ownerId || actor.uid,
        slug: slugify(v.title) || "item",
        images: input.images,
        status,
        createdAt: old?.createdAt ?? now,
        updatedAt: now,
        searchTokens: tokens(
          `${v.title} ${v.make} ${v.model} ${v.subcategory} ${v.details.brand} ${v.description}`,
        ),
        ...(firstPublish
          ? {
              publishedAt: now,
              originalAskingPrice: v.price,
            }
          : {}),
        ...(!old || old.status !== status ? { lastStatusChangeAt: now } : {}),
      };
      tx.set(ref, next);
      if (!old || old.status !== status || old.price !== v.price)
        tx.create(ref.collection("history").doc(), {
          kind: "save",
          from: old?.status || null,
          to: status,
          askingPrice: v.price,
          previousAskingPrice: old?.price ?? null,
          at: now,
        });
      return { status, slug: next.slug };
    }
    if (!old) throw new ListingError("Listing not found.", 404);
    if (action === "anonymise") {
      if (!actor.admin)
        throw new ListingError("Administrator access required.", 403);
      if (!["sold", "expired", "on-hold"].includes(old.status))
        throw new ListingError("Only historical adverts can be de-identified.");
      if (old.sellerAnonymised) return { status: old.status, slug: old.slug };
      // Free text and photographs may contain identifying information: remove conservatively.
      tx.update(ref, {
        ownerId: "",
        sellerAnonymised: true,
        slug: slugify(
          [old.make, old.model, old.year || "", "historical-advert"]
            .filter(Boolean)
            .join(" "),
        ),
        title: [old.make, old.model, old.year || "", "historical advert"]
          .filter(Boolean)
          .join(" "),
        description: "Seller information removed following a privacy request.",
        specs: "",
        city: "",
        images: [],
        details: {},
        searchTokens: [],
        updatedAt: now,
      });
      tx.set(ref.collection("mediaCleanup").doc("pending"), {
        ownerId: mediaOwner,
      });
      return { status: old.status, slug: old.slug };
    }
    if (action !== "status" || typeof input.status !== "string")
      throw new ListingError("Invalid action.");
    if (old.status === "removed" && input.status === "removed")
      return { status: "removed", slug: "removed" };
    if (!canTransition(old.status, input.status, staff))
      throw new ListingError("This status change is not allowed.", 409);
    if (input.status === "published") {
      const valid = listingSchema.safeParse(old);
      if (!valid.success || !old.images?.length)
        throw new ListingError("Complete the advert before publishing.");
    }
    if (input.status === "removed") {
      // Drop all public content. Retain owner only until media cleanup completes, for safe retry.
      tx.set(ref, {
        id,
        ownerId: old.ownerId,
        status: "removed",
        removedAt: now,
        slug: "removed",
      });
      if (mediaOwner)
        tx.set(ref.collection("mediaCleanup").doc("pending"), {
          ownerId: mediaOwner,
        });
    } else {
      tx.update(ref, {
        status: input.status,
        updatedAt: now,
        lastStatusChangeAt: now,
        ...(input.status === "published" &&
        old.status === "draft" &&
        !old.publishedAt
          ? { publishedAt: now, originalAskingPrice: old.price }
          : {}),
        ...(input.status === "sold" ? { soldAt: now } : {}),
        ...(input.status === "expired" ? { expiredAt: now } : {}),
      });
      if (["hidden", "rejected"].includes(input.status))
        tx.set(ref.collection("mediaCleanup").doc("pending"), {
          ownerId: old.ownerId,
          mode: "restrict",
        });
    }
    if (input.status !== "removed")
      tx.create(ref.collection("history").doc(), {
        kind: "status",
        from: old.status,
        to: input.status,
        at: now,
        askingPrice: old.price,
      });
    return { status: input.status, slug: old.slug };
  });
}
