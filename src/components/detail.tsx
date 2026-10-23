"use client";
import { RatingBadge } from "./member-reviews";
import { requestText } from "@/components/ui/dialogs";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  MessageCircle,
  Share2,
  Flag,
  Truck,
  Check,
} from "lucide-react";
import { addDoc, collection, doc, runTransaction } from "firebase/firestore";
import { Listing, money, displayDetails } from "@/lib/models";
import { db } from "@/lib/firebase";
import { useSession } from "./session";
import { Favourite, Card } from "./card";
import { CategoryBreadcrumbs } from "./category-navigation";
import { categoryById, resolveCategoryId } from "@/lib/taxonomy";
import { provinces } from "@/lib/marketplace";
import { Gallery } from "./gallery";
import { isHistorical, statusLabel } from "@/lib/listing-history";
export function ListingDetail({
  listing: l,
  similar,
}: {
  listing: Listing;
  similar: Listing[];
}) {
  const [notice, setNotice] = useState("");
  const { user } = useSession();
  const router = useRouter();
  async function contact() {
    if (l.status !== "published") {
      setNotice("This advert is no longer accepting enquiries.");
      return;
    }
    if (!user) {
      router.push("/auth");
      return;
    }
    if (user.uid === l.ownerId) {
      setNotice("This is your listing.");
      return;
    }
    try {
      const id = `${l.id}_${user.uid}`;
      const ref = doc(db, "conversations", id);
      await runTransaction(db, async (tx) => {
        const existing = await tx.get(ref);
        if (!existing.exists())
          tx.set(ref, {
            listingId: l.id,
            listingTitle: l.title,
            buyerId: user.uid,
            sellerId: l.ownerId,
            participants: [user.uid, l.ownerId],
            createdAt: Date.now(),
          });
      });
      router.push(`/messages?conversation=${id}`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Unable to contact seller.");
    }
  }
  return (
    <section className="wrap section">
      <CategoryBreadcrumbs id={l.categoryId} />
      {isHistorical(l) && (
        <div className="notice" role="status">
          <h2>{statusLabel(l.status).toUpperCase()}</h2>
          <p>
            {l.status === "sold"
              ? "This item has been sold."
              : l.status === "expired"
                ? "This advert has expired."
                : "This advert is on hold."}{" "}
            This advertisement is retained for historical reference. It is
            unavailable for new enquiries.
          </p>
          <Link href={`/browse?category=${encodeURIComponent(l.categoryId)}`}>
            Browse similar items
          </Link>
          {" · "}
          <Link href="/account/saved-searches">Saved searches</Link>
          {" · "}
          <Link href="/policies/history">History and removal policy</Link>
        </div>
      )}
      <div className="detail-grid">
        <div>
          <Gallery images={l.images} title={l.title} />
          <div className="detail-section">
            <div className="eyebrow">THE DETAILS</div>
            <h2>
              {isHistorical(l)
                ? "Advertised details"
                : "Ready for its next chapter."}
            </h2>
            <div className="spec-grid">
              {[
                ["Make", l.make],
                ["Model", l.model],
                [
                  "Year",
                  ["motorcycles", "parts"].includes(l.primaryCategoryId)
                    ? l.year
                    : "",
                ],
                ["Condition", l.condition],
                [
                  "Category",
                  categoryById[resolveCategoryId(l.categoryId)]?.name ||
                    l.subcategory,
                ],
                ...displayDetails(l.details),
              ]
                .filter(([, value]) => Boolean(value))
                .map(([k, v]) => (
                  <div key={k}>
                    <small>{k}</small>
                    <b>{v}</b>
                  </div>
                ))}
            </div>
            {l.specs && (
              <>
                <h3>
                  {l.primaryCategoryId === "parts"
                    ? "Compatibility & part details"
                    : "Specifications & service notes"}
                </h3>
                <div className="spec-notes">
                  {l.specs
                    .split(/\n/)
                    .filter(Boolean)
                    .map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                </div>
              </>
            )}
            <h3>From the seller</h3>
            <p className="description">{l.description}</p>
            {l.category === "Parts" && (
              <p className="notice">
                Fitment details are seller-provided claims. Confirm model, year
                range and part number before buying.
              </p>
            )}
            <h3>
              <Truck size={18} /> Collection & shipping
            </h3>
            <p>
              {l.shipping}. Confirm domestic shipping costs, collection and
              payment arrangements directly with the seller.
            </p>
          </div>
        </div>
        <aside className="detail-aside">
          <div className="eyebrow">
            {categoryById[resolveCategoryId(l.categoryId)]?.name ||
              l.subcategory}{" "}
            · {l.condition}
          </div>
          <h1>{l.title}</h1>
          <div className="detail-price">
            {money(l)} <small>{l.currency}</small>
          </div>
          <p className="location">
            <MapPin size={17} />
            {l.city},{" "}
            {provinces[l.region as keyof typeof provinces] || l.region},{" "}
            {l.country}
          </p>
          <small>
            Listed{" "}
            {new Date(l.publishedAt || l.createdAt).toLocaleDateString("en-ZA")}{" "}
            · Ref {l.id}
          </small>
          {isHistorical(l) && (
            <p>
              <b>Last advertised asking price</b> — not a verified completed
              transaction price.
              {l.originalAskingPrice !== undefined && (
                <>
                  {" "}
                  Originally advertised at{" "}
                  {money({
                    price: l.originalAskingPrice,
                    currency: l.currency,
                  })}
                  .
                </>
              )}
            </p>
          )}
          {l.soldAt && (
            <p>Marked sold {new Date(l.soldAt).toLocaleDateString("en-ZA")}</p>
          )}
          {l.expiredAt && l.status === "expired" && (
            <p>Expired {new Date(l.expiredAt).toLocaleDateString("en-ZA")}</p>
          )}
          <button
            className="button"
            onClick={contact}
            disabled={l.status !== "published"}
          >
            <MessageCircle size={18} /> Message seller
          </button>
          <div className="detail-actions">
            <Favourite listing={l} />
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(location.href);
                  setNotice("Listing link copied.");
                } catch {
                  setNotice(location.href);
                }
              }}
            >
              <Share2 size={17} /> Share
            </button>
            <button
              onClick={async () => {
                if (!user) {
                  router.push("/auth");
                  return;
                }
                const reason = await requestText(
                  "Why are you reporting this listing?",
                );
                if (!reason || reason.length < 10) {
                  setNotice("Please provide at least 10 characters.");
                  return;
                }
                try {
                  await addDoc(collection(db, "listingReports"), {
                    listingId: l.id,
                    reporterId: user.uid,
                    reason: reason.slice(0, 1500),
                    status: "open",
                    createdAt: Date.now(),
                  });
                  setNotice("Report submitted for review.");
                } catch {
                  setNotice("Unable to submit report.");
                }
              }}
            >
              <Flag size={17} /> Report
            </button>
          </div>
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          {!l.sellerAnonymised && l.ownerId ? (
            <div className="seller-box">
              <span className="avatar">R</span>
              <div>
                <b>Marketplace seller</b>
                <RatingBadge uid={l.ownerId} />
                <Link href={`/seller/${l.ownerId}`}>View seller profile →</Link>
              </div>
            </div>
          ) : (
            <p>
              Seller account removed. This record contains historical item
              information.
            </p>
          )}
          <div className="buying-tip">
            <Check size={18} />
            <span>
              Ride smart. Inspect before paying. Never send a deposit just to
              view an item.
            </span>
          </div>
        </aside>
      </div>
      {similar.length > 0 && (
        <div className="section">
          <h2>More to explore.</h2>
          <div className="listing-grid">
            {similar
              .filter((x) => x.id !== l.id && x.category === l.category)
              .slice(0, 4)
              .map((x) => (
                <Card listing={x} key={x.id} />
              ))}
          </div>
        </div>
      )}
    </section>
  );
}
