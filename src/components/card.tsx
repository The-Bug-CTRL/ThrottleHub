"use client";
import { sellerLabel } from "@/lib/seller-account";
import { ListingAge } from "./listing-age";
import Link from "next/link";
import { Heart, MapPin, ArrowUpRight } from "lucide-react";
import { provinces } from "@/lib/marketplace";
import { categoryById, resolveCategoryId } from "@/lib/taxonomy";
import { Listing, money } from "@/lib/models";
import { useSession } from "./session";
import { db } from "@/lib/firebase";
import { doc, setDoc, deleteDoc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { dataError } from "@/lib/errors";
import {
  isPublicListing,
  listingHref,
  statusLabel,
} from "@/lib/listing-history";
export function Favourite({ listing }: { listing: Listing }) {
  const { user } = useSession();
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!user) {
      setSaved(false);
      return;
    }
    let active = true;
    getDoc(doc(db, "users", user.uid, "favourites", listing.id))
      .then((d) => {
        if (active) setSaved(d.exists());
      })
      .catch(() => {
        if (active) setMessage("Unable to load saved state.");
      });
    return () => {
      active = false;
    };
  }, [user, listing.id]);
  return (
    <>
      <button
        className={`favourite ${saved ? "saved" : ""}`}
        aria-label={saved ? "Remove favourite" : "Save favourite"}
        onClick={async () => {
          if (!user) {
            setMessage("Sign in to save this item.");
            return;
          }
          try {
            const ref = doc(db, "users", user.uid, "favourites", listing.id);
            if (saved) await deleteDoc(ref);
            else
              await setDoc(ref, {
                listingId: listing.id,
                createdAt: Date.now(),
              });
            setSaved(!saved);
          } catch (error) {
            setMessage(dataError(error));
          }
        }}
      >
        <Heart size={18} fill={saved ? "currentColor" : "none"} />
      </button>
      {message && (
        <span className="card-notice" onClick={() => setMessage("")}>
          {message} <Link href="/auth">Sign in →</Link>
        </span>
      )}
    </>
  );
}
export function Card({ listing: l }: { listing: Listing }) {
  const href = isPublicListing(l) ? listingHref(l) : `/sell?edit=${l.id}`;
  return (
    <article className="listing-card">
      <div className="card-photo">
        <Link href={href}>
          <img
            src={l.images[0] || "/no-photo.svg"}
            alt={l.title}
            loading="lazy"
            decoding="async"
          />
        </Link>
        <Favourite listing={l} />
      </div>
      <Link className="card-info" href={href}>
        <div className="eyebrow">
          {categoryById[resolveCategoryId(l.categoryId)]?.name || l.subcategory}{" "}
          <ArrowUpRight size={15} />
        </div>
        <h3>{l.title}</h3>
        {l.promotion && (
          <span className="promotion-badge">
            {l.promotion.test ? "TEST " : ""}
            {l.promotion.featured ? "Featured" : "Promoted"}
          </span>
        )}
        {isPublicListing(l) && (
          <small>
            <ListingAge publishedAt={l.publishedAt || l.createdAt} />
          </small>
        )}
        <span className="seller-kind-badge">
          {sellerLabel(l.sellerAccountType || l.details?.sellerType)}
        </span>
        {l.status !== "published" && (
          <span className="notice">{statusLabel(l.status)}</span>
        )}
        {l.primaryCategoryId === "motorcycles" && l.year > 0 && (
          <span className="card-model-year">Model year {l.year}</span>
        )}
        <p className="specs">{l.specs}</p>
        <strong>{money(l)}</strong>
        <div className="card-bottom">
          <span>
            <MapPin size={12} />
            {l.city},{" "}
            {provinces[l.region as keyof typeof provinces] || l.country}
          </span>
          <span>
            {new Date(l.createdAt).toLocaleDateString("en-ZA", {
              day: "numeric",
              month: "short",
              timeZone: "UTC",
            })}
          </span>
        </div>
      </Link>
    </article>
  );
}
