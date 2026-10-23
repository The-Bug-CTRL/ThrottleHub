"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { collection, doc, getDoc } from "firebase/firestore";
import { changeListing } from "@/lib/listing-client";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
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
import { categoryById, categoryFields, legacyCategory } from "@/lib/taxonomy";
import {
  motorcycleCatalogue,
  provinces,
  provinceCode,
} from "@/lib/marketplace";
import { ListingDetailsFields } from "./listing-details-fields";
import { LoadingState } from "./ui/primitives";
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
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
  const [images, setImages] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<"draft" | "published" | null>(null);
  const [savedSlug, setSavedSlug] = useState("");
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
      specs: "",
    },
  });
  const categoryId = watch("categoryId");
  const itemType = categoryById[categoryId]?.itemType;
  const make = watch("make");
  function chooseCategory(id: string) {
    if (!id) return;
    const fields = categoryFields(id);
    setValue("categoryId", id);
    setValue("category", fields.category);
    setValue("subcategory", fields.subcategory);
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
            const cat =
              old.categoryId || legacyCategory(old.category, old.subcategory);
            reset({
              ...getValues(),
              ...old,
              ...(cat ? categoryFields(cat) : {}),
              region: provinceCode(old.region),
              details: { ...getValues("details"), ...old.details },
            } as ListingInput);
            if (old.country !== "ZA" || old.currency !== "ZAR")
              setNotice(
                "This advert is outside the South African launch. It remains private to you; only change its location if the item is actually in South Africa.",
              );
            setImages(d.data().images || []);
          } else setNotice("Listing unavailable or not yours.");
        })
        .catch(() => setNotice("Unable to load listing."));
  }, [edit, user, reset, getValues]);
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
    setSaving(true);
    try {
      const result = await changeListing(user, id, {
        action: "save",
        values: normalized,
        images,
        status,
      });
      setSavedSlug(result.slug);
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
  if (success)
    return (
      <section className="auth-panel publish-success">
        <CheckCircle2 size={42} />
        <div className="eyebrow">All set</div>
        <h1>
          {success === "published"
            ? "Your listing is live."
            : "Your draft is saved."}
        </h1>
        <p>
          {success === "published"
            ? "Your item is now available in the marketplace. You can edit it, respond to buyers and mark it sold from your garage."
            : "Your listing is safely saved to your account. Return to your garage whenever you’re ready to finish it."}
        </p>
        {success === "published" && (
          <Link
            className="button"
            href={`/listing/${id}/${savedSlug}`}
          >
            View your listing
          </Link>
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
                placeholder="e.g. 2023 KTM 300 EXC TPI"
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
                    for (const file of files) {
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
                      const target = ref(
                        storage,
                        `listing-images/${user.uid}/${id}/${crypto.randomUUID()}.jpg`,
                      );
                      const task = uploadBytesResumable(target, blob, {
                        contentType: "image/jpeg",
                        cacheControl: "public, max-age=300",
                      });
                      await new Promise<void>((resolve, reject) =>
                        task.on(
                          "state_changed",
                          (s) =>
                            setProgress(
                              Math.round(
                                (100 * s.bytesTransferred) / s.totalBytes,
                              ),
                            ),
                          reject,
                          () => resolve(),
                        ),
                      );
                      const url = await getDownloadURL(target);
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
              <LoadingState size={64} label={`Uploading ${progress}%`} />
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
                <input type="number" {...register("price")} />
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
            <label>
              Collection / shipping
              <select {...register("shipping")}>
                {["Collection only", "Domestic shipping"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
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
            <button className="button" disabled={saving || progress !== null}>
              Publish listing
            </button>
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
