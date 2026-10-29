import type { Firestore } from "firebase-admin/firestore";
import type { Bucket } from "@google-cloud/storage";
import { categoryFields } from "./taxonomy";
import { deliveryShipping } from "./listing-guidance";
import {
  listingSchema,
  parseListingDraft,
  slugify,
  tokens,
  type ListingInput,
} from "./models";
import { canTransition } from "./listing-history";
import { requiresRunningVideo } from "./taxonomy";
import { accountTypeOf } from "./seller-account";
import { videoIsReady } from "./running-video";
import { entitlementRef } from "../../payments-functions/src/core/promotions";

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
    let object = "";
    try {
      object = url.pathname.startsWith(prefix)
        ? decodeURIComponent(url.pathname.slice(prefix.length))
        : "";
    } catch {
      throw new ListingError("Invalid photo URL.");
    }
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
  bucket?: Bucket,
) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id))
    throw new ListingError("Invalid listing ID.");
  const ref = db.collection("listings").doc(id);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const restriction = await tx.get(
      db.collection("restrictions").doc(actor.uid),
    );
    if (restriction.data()?.suspended === true)
      throw new ListingError(
        "This account is restricted from changing listings.",
        403,
      );
    const old = snap.data();
    const promotions = await Promise.all(
      ["test", "live"].map((env) =>
        tx.get(entitlementRef(db, env as "test" | "live", id)),
      ),
    );
    const stopPromotions = () => {
      for (const promotion of promotions)
        if (promotion.exists)
          tx.update(promotion.ref, {
            featuredActive: false,
            bumpActive: false,
            suspendedReason: "listing_unavailable",
            updatedAt: now,
          });
    };
    const profile = await tx.get(
      db.collection("profiles").doc(old?.ownerId || actor.uid),
    );
    const sellerAccountType =
      old && old.status !== "draft"
        ? old.sellerAccountType ||
          (old.details?.sellerType === "dealer" ? "business" : "personal")
        : accountTypeOf(profile.data());
    const requestedVideo =
      input.runningVideoId === undefined
        ? old?.runningVideoId
        : input.runningVideoId;
    if (
      requestedVideo &&
      (typeof requestedVideo !== "string" ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(requestedVideo))
    )
      throw new ListingError("Invalid video ID.");
    const readyVideo = requestedVideo
      ? (await tx.get(ref.collection("videos").doc(requestedVideo))).data()
      : undefined;
    // New trusted photo IDs are generation-bound. Legacy photos remain readable;
    // migration/inspection of pre-existing objects is a separate release task.
    const photos = input.action === "save" ? input.images : old?.images;
    const acceptedPhotos = [];
    if (
      (input.action === "save" ||
        (input.action === "status" && input.status === "published")) &&
      Array.isArray(photos)
    )
      for (const url of photos) {
        if (typeof url !== "string") continue;
        const match =
          /\/([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})[.]jpg$/.exec(
            (() => {
              try {
                return decodeURIComponent(new URL(url).pathname);
              } catch {
                return "";
              }
            })(),
          );
        if (match) {
          const photo = (
            await tx.get(ref.collection("photos").doc(match[1]))
          ).data();
          if (
            !photo ||
            photo.status !== "ready" ||
            photo.uploaderId !== (old?.ownerId || actor.uid) ||
            photo.listingId !== id ||
            photo.path !==
              `listing-images/${old?.ownerId || actor.uid}/${id}/${match[1]}.jpg`
          )
            throw new ListingError(
              "Photo is unavailable. Upload it again.",
              409,
            );
          acceptedPhotos.push(photo);
        }
      }
    const pending = old
      ? (await tx.get(ref.collection("mediaCleanup").doc("pending"))).data()
      : undefined;
    const mediaOwner = pending?.ownerId || old?.ownerId;
    const staff = actor.admin === true || actor.moderator === true;
    if (old && old.ownerId !== actor.uid && !staff)
      throw new ListingError("This listing is not yours.", 403);
    const action = input.action;
    // Staff may restrict adverts; editing, selling and relisting still belong to their owner.
    if (
      old &&
      old.ownerId !== actor.uid &&
      !actor.admin &&
      !(
        actor.moderator &&
        action === "status" &&
        ["hidden", "rejected"].includes(String(input.status))
      )
    )
      throw new ListingError("Only the seller can perform this action.", 403);
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
      const values = { ...input.values as Record<string, unknown>, ...(old?.deliveryMethods && !(input.values as Record<string, unknown>)?.deliveryMethods ? { deliveryMethods: old.deliveryMethods } : {}) };
      const parsed =
        status === "draft"
          ? parseListingDraft(values as ListingInput)
          : listingSchema.safeParse(values);
      if (!parsed.success)
        throw new ListingError(
          parsed.error.issues.map((i) => i.message).join("; "),
        );
      const v = parsed.data;
      if (status === "published" && ((!old || old.status === "draft") && !old?.publishedAt || v.deliveryMethods !== undefined) && !v.deliveryMethods?.length)
        throw new ListingError("Choose at least one delivery or collection method before publishing.");
      if (v.deliveryMethods !== undefined) v.shipping = deliveryShipping(v.deliveryMethods);
      const motorcycle = requiresRunningVideo(v.categoryId);
      if (
        status === "published" &&
        motorcycle &&
        ["two-stroke", "four-stroke"].includes(v.details.engineType) &&
        (readyVideo?.demonstration !== "petrol" ||
          readyVideo?.hasAudio !== true)
      )
        throw new ListingError(
          "Petrol motorcycles need a running video with sound.",
        );
      if (
        status === "published" &&
        motorcycle &&
        !videoIsReady(readyVideo, old?.ownerId || actor.uid, id)
      )
        throw new ListingError(
          "Upload and validate the motorcycle running video before publishing.",
        );
      if (
        !Array.isArray(input.images) ||
        input.images.length > 8 ||
        (status === "published" && !input.images.length)
      )
        throw new ListingError("Add a photo before publishing.");
      if (
        status === "published" &&
        videoIsReady(readyVideo, old?.ownerId || actor.uid, id)
      )
        await requireVideoObject(bucket, readyVideo);
      if (status === "published")
        for (const photo of acceptedPhotos)
          await requirePhotoObject(bucket, photo);
      const firstPublish =
        status === "published" &&
        (!old || old.status === "draft") &&
        !old?.publishedAt;
      const next = {
        ...old,
        ...v,
        ...categoryFields(v.categoryId),
        details: {
          ...v.details,
          sellerType: sellerAccountType === "business" ? "dealer" : "private",
        },
        id,
        ownerId: old?.ownerId || actor.uid,
        slug: slugify(v.title) || "item",
        images: input.images,
        runningVideoId: videoIsReady(readyVideo, old?.ownerId || actor.uid, id)
          ? requestedVideo
          : "",
        runningVideo: videoIsReady(readyVideo, old?.ownerId || actor.uid, id)
          ? readyVideo
          : null,
        sellerAccountType: sellerAccountType,
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
      return { status, slug: next.slug, firstPublish };
    }
    if (!old) throw new ListingError("Listing not found.", 404);
    if (action === "anonymise") {
      if (!actor.admin)
        throw new ListingError("Administrator access required.", 403);
      if (!["sold", "expired", "on-hold"].includes(old.status))
        throw new ListingError("Only historical adverts can be de-identified.");
      if (old.sellerAnonymised) return { status: old.status, slug: old.slug };
      stopPromotions();
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
        runningVideo: null,
        runningVideoId: "",
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
      if (
        requiresRunningVideo(old.categoryId) &&
        ["two-stroke", "four-stroke"].includes(old.details?.engineType) &&
        (readyVideo?.demonstration !== "petrol" ||
          readyVideo?.hasAudio !== true)
      )
        throw new ListingError(
          "Petrol motorcycles need a running video with sound.",
        );
      if (
        requiresRunningVideo(old.categoryId) &&
        !videoIsReady(readyVideo, old.ownerId, id)
      )
        throw new ListingError(
          "Add a validated running video before relisting. Edit and save the draft first.",
        );
      const valid = listingSchema.safeParse(old);
      if ((old.status === "draft" && !old.publishedAt || old.deliveryMethods !== undefined) && !old.deliveryMethods?.length)
        throw new ListingError("Choose at least one delivery or collection method before publishing.");
      if (!valid.success || !old.images?.length)
        throw new ListingError("Complete the advert before publishing.");
      if (requiresRunningVideo(old.categoryId))
        await requireVideoObject(bucket, readyVideo!);
      for (const photo of acceptedPhotos)
        await requirePhotoObject(bucket, photo);
    }
    if (input.status !== "published") stopPromotions();
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
        ...(input.status === "published"
          ? {
              runningVideoId: requestedVideo || "",
              runningVideo: readyVideo || null,
              sellerAccountType: sellerAccountType,
            }
          : {}),
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

async function requirePhotoObject(
  bucket: Bucket | undefined,
  photo: FirebaseFirestore.DocumentData,
) {
  if (!bucket) throw new ListingError("Photo storage is unavailable.", 503);
  let metadata;
  try {
    [metadata] = await bucket.file(photo.path).getMetadata();
  } catch (error) {
    if ((error as { code?: number }).code === 404)
      throw new ListingError("Photo is missing. Upload it again.", 409);
    throw error;
  }
  if (
    String(metadata.generation) !== photo.generation ||
    Number(metadata.size) !== photo.size ||
    metadata.contentType !== "image/jpeg"
  )
    throw new ListingError("Photo has changed. Upload it again.", 409);
}

// Run while the transaction holds the ready-record version. Cleanup claims that
// record transactionally before deleting; accepted objects are never client writable.
async function requireVideoObject(
  bucket: Bucket | undefined,
  video: NonNullable<Parameters<typeof videoIsReady>[0]>,
) {
  if (!bucket) throw new ListingError("Video storage is unavailable.", 503);
  let metadata;
  try {
    [metadata] = await bucket.file(video.path!).getMetadata();
  } catch (error) {
    if ((error as { code?: number }).code === 404)
      throw new ListingError(
        "Running video is missing. Upload and validate it again.",
        409,
      );
    throw error;
  }
  if (
    String(metadata.generation) !== video.generation ||
    Number(metadata.size) !== video.size ||
    metadata.contentType !== "video/mp4"
  )
    throw new ListingError(
      "Running video has changed. Upload and validate it again.",
      409,
    );
}
