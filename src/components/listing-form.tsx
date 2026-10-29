"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { collection, doc, getDoc } from "firebase/firestore";
import { RunningVideoUpload } from "./running-video-upload";
import { accountTypeOf } from "@/lib/seller-account";
import { videoIsReady, type RunningVideo } from "@/lib/running-video";
import { changeListing } from "@/lib/listing-client";
import { db } from "@/lib/firebase";
import { brand } from "@/lib/config";
import {
  ListingInput,
  listingSchema,
  parseListingDraft,
  displayDetails,
} from "@/lib/models";
import { useSession } from "./session";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { CategoryPicker } from "./category-navigation";
import {
  categoryById,
  categoryFields,
  legacyCategory,
  requiresRunningVideo,
} from "@/lib/taxonomy";
import {
  motorcycleCatalogue,
  provinces,
  provinceCode,
} from "@/lib/marketplace";
import { ListingDetailsFields } from "./listing-details-fields";
import { LoadingState } from "./ui/primitives";
import { compatibleDelivery, deliveryOptions, deliveryShipping, listingTitleExample } from "@/lib/listing-guidance";
import { PostPublishOffer } from "./post-publish-offer";
async function compress(file: File): Promise<Blob> {
  let objectURL = "";
  let bitmap: ImageBitmap | HTMLImageElement;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    objectURL = URL.createObjectURL(file);
    const image = new Image();
    image.src = objectURL;
    try {
      await image.decode();
    } catch {
      URL.revokeObjectURL(objectURL);
      throw new Error(
        "Unable to read this photo. Export it as JPEG or PNG first.",
      );
    }
    bitmap = image;
  }
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if ("close" in bitmap) bitmap.close();
  if (objectURL) URL.revokeObjectURL(objectURL);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Unable to process image."))),
      "image/jpeg",
      0.84,
    ),
  );
}
export function ListingForm() {
  const { user, loading } = useSession();
  const params = useSearchParams();
  const edit = params.get("edit");
  const [id, setId] = useState("");
  const [stage, setStage] = useState(0);
  const [relistOnly, setRelistOnly] = useState(false);
  const [runningVideo, setRunningVideo] = useState<RunningVideo | null>(null);
  const [videoBusy, setVideoBusy] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [photoLabel, setPhotoLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<"draft" | "published" | null>(null);
  const [savedSlug, setSavedSlug] = useState("");
  const [offerPromotion, setOfferPromotion] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    getValues,
    trigger,
    setValue,
    formState: { errors },
  } = useForm<ListingInput>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "Motorcycles",
      categoryId: "motorcycles",
      details: {
        engineType: "",
        displacement: 0,
        hours: 0,
        yearFrom: 0,
        yearTo: 0,
        fuelSystem: "",
        origin: "",
        partNumber: "",
        brand: "",
        size: "",
        sizeSystem: "",
        sellerType: "private",
        vintage: false,
      },
      subcategory: "Motorcycles",
      make: "",
      model: "",
      year: 0,
      price: 0,
      country: "ZA",
      currency: "ZAR",
      region: "",
      city: "",
      condition: "Good",
      shipping: "Collection only",
      deliveryMethods: [],
      specs: "",
    },
  });
  const categoryId = watch("categoryId");
  const itemType = categoryById[categoryId]?.itemType;
  const videoRequired = requiresRunningVideo(categoryId);
  const make = watch("make");
  const categoryValues = useRef(new Map<string, ListingInput>());
  function chooseCategory(id: string) {
    if (!id) return;
    const current = getValues();
    categoryValues.current.set(current.categoryId, structuredClone(current));
    const fields = categoryFields(id);
    setValue("categoryId", id);
    setValue("category", fields.category);
    setValue("subcategory", fields.subcategory);
    if (current.deliveryMethods !== undefined) {
      const methods = compatibleDelivery(id, current.deliveryMethods);
      setValue("deliveryMethods", methods, { shouldDirty: true });
      setValue("shipping", deliveryShipping(methods));
      if (methods.length !== current.deliveryMethods.length) setNotice("Delivery options changed with the category. Please check your selections.");
    }
    const nextType = categoryById[id].itemType;
    if (nextType !== "gear") {
      setValue("details.size", "");
      setValue("details.sizeSystem", "");
    }
    if (nextType === "motorcycle") setValue("details.brand", "");
    if (nextType !== "part") {
      setValue("details.origin", "");
      setValue("details.partNumber", "");
      setValue("details.yearFrom", 0);
      setValue("details.yearTo", 0);
    }
    if (nextType !== "motorcycle") setValue("details.hours", 0);
    if (!["motorcycle", "part"].includes(categoryById[id].itemType)) {
      setValue("make", "");
      setValue("model", "");
      setValue("year", 0);
      setValue("details.vintage", false);
      for (const key of [
        "engineType",
        "fuelSystem",
        "origin",
        "partNumber",
      ] as const)
        setValue(`details.${key}`, "");
      for (const key of [
        "displacement",
        "hours",
        "yearFrom",
        "yearTo",
      ] as const)
        setValue(`details.${key}`, 0);
    }
    const engine = categoryById[id].engineTypes?.[0];
    if (engine)
      setValue("details.engineType", engine as "two-stroke" | "four-stroke");
    const saved = categoryValues.current.get(id);
    if (saved) {
      setValue("details", saved.details);
      setValue("make", saved.make);
      setValue("model", saved.model);
      setValue("year", saved.year);
    }
  }
  async function goToStage(target: number) {
    setNotice("");
    if (target <= stage) {
      setStage(target);
      return;
    }
    const fields: (keyof ListingInput)[] =
      stage === 0
        ? [
            "category",
            "categoryId",
            "details",
            "subcategory",
            "title",
            "description",
            "make",
            "model",
            "year",
            "condition",
            "specs",
          ]
        : ["price", "currency", "country", "region", "city", "shipping"];
    if (!(await trigger(fields, { shouldFocus: true }))) return;
    if (stage === 1 && !images.length) {
      setNotice("Add at least one photograph before continuing.");
      return;
    }
    setStage(stage === 0 ? 1 : target);
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  useEffect(() => {
    setId(edit || doc(collection(db, "listings")).id);
    if (edit && user)
      getDoc(doc(db, "listings", edit))
        .then((d) => {
          if (d.exists() && d.data().ownerId === user.uid) {
            const old = d.data();
            setRelistOnly(
              ["expired", "on-hold"].includes(old.status) &&
                requiresRunningVideo(
                  old.categoryId ||
                    legacyCategory(old.category, old.subcategory),
                ),
            );
            const cat =
              old.categoryId || legacyCategory(old.category, old.subcategory);
            reset({
              ...getValues(),
              ...old,
              deliveryMethods: old.deliveryMethods,
              ...(cat ? categoryFields(cat) : {}),
              region: provinceCode(old.region),
              details: { ...getValues("details"), ...old.details },
            } as ListingInput);
            if (old.country !== "ZA" || old.currency !== "ZAR")
              setNotice(
                "This advert is outside the South African launch. It remains private to you; only change its location if the item is actually in South Africa.",
              );
            setImages(d.data().images || []);
            setRunningVideo(d.data().runningVideo || null);
          } else setNotice("Listing unavailable or not yours.");
        })
        .catch(() => setNotice("Unable to load listing."));
  }, [edit, user, reset, getValues]);
  useEffect(() => {
    if (!user || edit) return;
    let cancelled = false;
    getDoc(doc(db, "profiles", user.uid))
      .then((profile) => {
        if (!cancelled)
          setValue(
            "details.sellerType",
            accountTypeOf(profile.data()) === "business" ? "dealer" : "private",
          );
      })
      .catch(() => {
        if (!cancelled)
          setNotice("Unable to load your seller profile. Please retry.");
      });
    return () => {
      cancelled = true;
    };
  }, [user, edit, setValue]);
  async function save(values: ListingInput, status: "draft" | "published") {
    if (!user) return;
    let normalized = {
      ...values,
      year: Number(values.year),
      price: Number(values.price),
    };
    const checked =
      status === "draft"
        ? parseListingDraft(normalized)
        : listingSchema.safeParse(normalized);
    if (!checked.success) {
      setNotice(
        checked.error.issues
          .map((i) => i.path.join(".") + ": " + i.message)
          .join("; "),
      );
      return;
    }
    normalized = checked.data;
    if (status === "published" && images.length === 0) {
      setNotice("Add at least one photo before publishing.");
      return;
    }
    if (
      videoBusy ||
      (status === "published" &&
        requiresRunningVideo(normalized.categoryId) &&
        !videoIsReady(runningVideo, user.uid, id))
    ) {
      setNotice(
        "Upload and validate a running video before publishing this motorcycle.",
      );
      return;
    }
    setSaving(true);
    try {
      const result = await changeListing(user, id, {
        action: "save",
        values: normalized,
        images,
        runningVideoId: runningVideo?.id || "",
        status,
      });
      setSavedSlug(result.slug);
      setOfferPromotion(result.firstPublish === true);
      setSuccess(status);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Unable to save listing.");
    } finally {
      setSaving(false);
    }
  }
  if (loading)
    return (
      <div className="wrap">
        <LoadingState label="Loading your garage…" />
      </div>
    );
  if (!user)
    return (
      <div className="auth-panel">
        <h1>Give your bike its next chapter.</h1>
        <p>
          Sign in to save drafts, upload photographs and manage your adverts.
        </p>
        <Link className="button" href="/auth">
          Sign in to start selling
        </Link>
      </div>
    );
  if (relistOnly && !success)
    return (
      <section className="form-panel">
        <h1>Add a running video and relist</h1>
        <p>
          Your historical advert stays unchanged until you reactivate it. Its
          original URL, price history and seller information are preserved.
        </p>
        <RunningVideoUpload
          user={user}
          listingId={id}
          value={runningVideo}
          onChange={setRunningVideo}
          onBusy={setVideoBusy}
          petrolRequired={["two-stroke", "four-stroke"].includes(
            watch("details.engineType"),
          )}
        />
        {notice && (
          <p role="alert" className="notice">
            {notice}
          </p>
        )}
        <button
          type="button"
          className="button"
          disabled={!runningVideo || videoBusy || saving}
          onClick={async () => {
            setSaving(true);
            try {
              const result = await changeListing(user, id, {
                action: "status",
                status: "published",
                runningVideoId: runningVideo?.id,
              });
              setSavedSlug(result.slug);
              setSuccess("published");
            } catch (e) {
              setNotice(e instanceof Error ? e.message : "Unable to relist");
            } finally {
              setSaving(false);
            }
          }}
        >
          Reactivate with this video
        </button>
      </section>
    );
  if (success)
    return (
      <section className="auth-panel publish-success">
        <CheckCircle2 size={42} />
        <div className="eyebrow">All set</div>
        <h1>
          {success === "published"
            ? "Your listing is live!"
            : "Your draft is saved."}
        </h1>
        <p>
          {success === "published"
            ? "Your item is now available in the marketplace. You can edit it, respond to buyers and mark it sold from your garage."
            : "Your listing is safely saved to your account. Return to your garage whenever you’re ready to finish it."}
        </p>
        {success === "published" && (
          <>
          {offerPromotion && <PostPublishOffer user={user} listingId={id} slug={savedSlug} />}
          {!offerPromotion &&
          <Link className="button" href={`/listing/${id}/${savedSlug}`}>
            View your listing
          </Link>}
          </>
        )}
        <Link className="text-button" href="/account">
          Back to my garage →
        </Link>
      </section>
    );
  return (
    <section className="form-panel">
      <div className="eyebrow">Your next chapter starts here</div>
      <h1>{edit ? "Fine-tune your listing." : "Let’s get it listed."}</h1>
      <p className="form-intro">
        A few good photos and an honest description. We’ll take it one step at a
        time.
      </p>
      <div className="steps" aria-label="Listing progress">
        {["The item", "Photos & price", "Review"].map((s, i) => (
          <button
            key={s}
            className={stage === i ? "active" : ""}
            aria-current={stage === i ? "step" : undefined}
            disabled={saving || progress !== null}
            onClick={() => goToStage(i)}
          >
            <span className="step-label">Step {i + 1} of 3</span>
            {s}
          </button>
        ))}
        <div className="step-progress" aria-hidden="true">
          <span style={{ width: `${((stage + 1) * 100) / 3}%` }} />
        </div>
      </div>
      <form onSubmit={handleSubmit((v) => save(v, "published"))}>
        {stage === 0 && (
          <>
            <h2>Tell us about your item.</h2>
            <p className="form-intro">
              Choose the right category so the right riders can find it.
            </p>
            <CategoryPicker
              value={categoryId}
              engineType={watch("details.engineType")}
              onChange={chooseCategory}
              required
            />
            <label>
              Listing title
              <input
                {...register("title")}
                placeholder={listingTitleExample(categoryId)}
              />
            </label>
            {["motorcycle", "part"].includes(itemType || "") && (
              <div className="field-row">
                <label>
                  {itemType === "part"
                    ? "Compatible make (seller-provided)"
                    : "Make"}
                  <select
                    {...register("make")}
                    onChange={(e) => {
                      setValue("make", e.target.value);
                      setValue("model", "");
                    }}
                  >
                    <option value="">Unknown / not specified</option>
                    {Object.keys(motorcycleCatalogue).map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Model
                  <select {...register("model")}>
                    <option value="">Unknown / not specified</option>
                    {(motorcycleCatalogue[make] || []).map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
                <label>
                  {itemType === "part"
                    ? "Exact compatible year (0 = unknown)"
                    : "Year (0 = unknown)"}
                  <input type="number" {...register("year")} />
                </label>
              </div>
            )}
            <ListingDetailsFields
              register={register}
              itemType={itemType}
              categoryId={categoryId}
            />
            <label>
              Specifications / service notes (optional)
              <textarea {...register("specs")} />
            </label>
            <label>
              Description
              <textarea
                rows={5}
                {...register("description")}
                placeholder="Condition, maintenance, rebuilds, modifications and anything the next owner should know."
              />
            </label>
            <label>
              Condition
              <select {...register("condition")}>
                {["New", "Excellent", "Good", "Used"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </>
        )}
        {stage === 1 && (
          <>
            <h2>Bring it to life.</h2>
            <p className="form-intro">
              Your first photo becomes the cover. Show the whole item and any
              details a buyer should see.
            </p>
            <label>
              Photographs (up to 8 · JPEG, PNG or WebP · max 10 MB each)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={progress !== null}
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length + images.length > 8) {
                    setNotice("Maximum 8 photos.");
                    return;
                  }
                  setProgress(0);
                  try {
                    for (const [index, file] of files.entries()) {
                      setPhotoLabel(
                        `Photo ${index + 1} of ${files.length}: ${file.name}`,
                      );
                      if (
                        !["image/jpeg", "image/png", "image/webp"].includes(
                          file.type,
                        ) ||
                        file.size > 10 * 1024 * 1024
                      )
                        throw new Error(
                          "Unsupported image type or file over 10 MB.",
                        );
                      const blob = await compress(file);
                      const response = await fetch(
                        "/api/listings/" + encodeURIComponent(id) + "/photos",
                        {
                          method: "POST",
                          headers: {
                            Authorization:
                              "Bearer " + (await user.getIdToken()),
                            "Content-Type": "image/jpeg",
                          },
                          body: blob,
                        },
                      );
                      const result = await response.json();
                      if (!response.ok)
                        throw new Error(result.error || "Photo upload failed.");
                      const url = result.url;
                      setProgress(
                        Math.round(((index + 1) / files.length) * 100),
                      );
                      setImages((old) => [...old, url]);
                    }
                  } catch (e) {
                    setNotice(
                      e instanceof Error ? e.message : "Upload failed.",
                    );
                  } finally {
                    setProgress(null);
                  }
                }}
              />
            </label>
            {progress !== null && (
              <LoadingState
                size={64}
                label={`${photoLabel}. Preparing/uploading. ${progress}% of selected photos completed.`}
              />
            )}
            {(videoRequired || runningVideo || videoBusy) && (
              <RunningVideoUpload
                user={user}
                listingId={id}
                value={runningVideo}
                onChange={setRunningVideo}
                onBusy={setVideoBusy}
                required={videoRequired}
                petrolRequired={
                  videoRequired &&
                  ["two-stroke", "four-stroke"].includes(
                    watch("details.engineType"),
                  )
                }
              />
            )}
            <div className="upload-previews">
              {images.map((src, i) => (
                <div key={src}>
                  <img src={src} alt={`Listing photo ${i + 1}`} />
                  <button
                    type="button"
                    onClick={() =>
                      setImages((old) => old.filter((_, n) => n !== i))
                    }
                  >
                    Remove
                  </button>
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setImages((old) => {
                          const a = [...old];
                          [a[i - 1], a[i]] = [a[i], a[i - 1]];
                          return a;
                        })
                      }
                    >
                      Move earlier
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="field-row">
              <label>
                Asking price
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  {...register("price")}
                />
              </label>
              <label>
                Currency
                <select {...register("currency")}>
                  {brand.currencies.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="field-row">
              <label>
                Country
                <select {...register("country")}>
                  {Object.entries(brand.countries)
                    .filter(([c]) => c !== "global")
                    .map(([c, n]) => (
                      <option key={c} value={c}>
                        {n}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Province
                <select {...register("region")}>
                  <option value="">Choose province</option>
                  {Object.entries(provinces).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                City / town
                <input {...register("city")} maxLength={80} />
                <small>
                  Your actual town; no street or residential address.
                </small>
              </label>
            </div>
            <fieldset className="delivery-options">
              <legend>Delivery &amp; Collection</legend>
              <p>Choose how you&apos;re willing to get this item to the buyer. You can select more than one option.</p>
              {watch("deliveryMethods") === undefined && <p>Current preference: {watch("shipping")}. You can keep this existing preference or choose specific methods below.</p>}
              <div>{deliveryOptions(categoryId).map((method) => <label key={method.id}><input type="checkbox" checked={watch("deliveryMethods")?.includes(method.id) || false} onChange={(event) => { const selected = getValues("deliveryMethods") || []; const next = event.target.checked ? [...selected, method.id] : selected.filter((id) => id !== method.id); setValue("deliveryMethods", next, { shouldDirty: true }); setValue("shipping", deliveryShipping(next)); }} />{method.label}</label>)}</div>
              <small>Seller preferences, not bookings or guaranteed services. Arrange costs and collection details privately with the buyer. Courier size, weight and coverage restrictions apply. Never add your street address to the advert.</small>
            </fieldset>
          </>
        )}
        {stage === 2 && (
          <div className="review">
            <div className="eyebrow">One last look</div>
            {images.length > 0 && (
              <div className="review-gallery">
                {images.map((src, i) => (
                  <img
                    key={src}
                    src={src}
                    alt={`Your listing photograph ${i + 1}`}
                  />
                ))}
              </div>
            )}
            <h2>{getValues("title") || "Your listing"}</h2>
            <p>{getValues("description")}</p>
            <p>
              {getValues("currency")} {getValues("price")} · {getValues("city")}
              , {getValues("country")}
            </p>
            <p>{getValues("specs")}</p>
            <p>{categoryById[categoryId]?.name}</p>
            <p>
              Details:{" "}
              {displayDetails(getValues("details"))
                .map(([k, v]) => k + ": " + v)
                .join(" / ")}
            </p>
            <p>
              {getValues("shipping")} · {images.length} photographs
            </p>
            <div className="notice">
              <ShieldCheck size={17} /> Confirm your description and ownership
              are accurate. No stolen goods, misleading adverts or unsafe
              content. Buyers and sellers arrange transactions directly.
            </div>
          </div>
        )}
        {Object.entries(errors).length > 0 && (
          <div className="notice error" role="alert">
            {Object.entries(errors).map(([key, e]) => (
              <p key={key}>
                {key}: {e.message}
              </p>
            ))}
          </div>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        {saving && <LoadingState size={64} label="Saving listing…" />}
        <div className="form-actions">
          {stage === 2 && (
            <button
              type="submit"
              className="button"
              disabled={saving || progress !== null || videoBusy}
            >
              Publish listing
            </button>
          )}
          <button
            type="button"
            className="text-button"
            disabled={saving || progress !== null}
            onClick={() => save(getValues(), "draft")}
          >
            Save draft
          </button>
          {stage > 0 && (
            <button type="button" onClick={() => setStage(stage - 1)}>
              Back
            </button>
          )}
          {stage < 2 && (
            <button
              type="button"
              className="button"
              disabled={saving || progress !== null}
              onClick={() => goToStage(stage + 1)}
            >
              Continue →
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
