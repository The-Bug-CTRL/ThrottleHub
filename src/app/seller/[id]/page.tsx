import { publicProfile } from "@/lib/profile-service";
import type { DocumentData } from "firebase-admin/firestore";
import { publicListing } from "@/lib/public-listing";
import { accountTypeOf, sellerLabel } from "@/lib/seller-account";
import { provinces } from "@/lib/marketplace";
import { FieldPath } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server";

import { ProfileListings } from "@/components/profile-listings";
import { FollowControls } from "@/components/follow-controls";
import { MemberAvatar } from "@/components/member-avatar";
import { Empty } from "@/components/empty";
import { MemberReviews, RatingBadge } from "@/components/member-reviews";
import Link from "next/link";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Seller({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) notFound();
  const p = await adminDb()
    .collection("profiles")
    .where(FieldPath.documentId(), "==", id)
    .select(
      "accountType",
      "business",
      "businessContactsPublic",
      "displayName",
      "bio",
      "city",
      "region",
      "country",
      "sellerType",
      "createdAt",
      "photoURL",
    )
    .limit(1)
    .get();
  if (p.empty) notFound();
  const profile = publicProfile(p.docs[0].data()) as DocumentData;
  const business =
    accountTypeOf(profile) === "business" ? profile.business : null;
  const [listings, threads] = await Promise.all([
    adminDb()
      .collection("listings")
      .where("country", "==", "ZA")
      .where("currency", "==", "ZAR")
      .where("ownerId", "==", id)
      .where("status", "==", "published")
      .limit(24)
      .get(),
    adminDb()
      .collection("forumThreads")
      .where("ownerId", "==", id)
      .where("status", "==", "published")
      .orderBy("createdAt", "desc")
      .limit(8)
      .get(),
  ]);
  return (
    <section className="wrap section">
      <div className="seller-profile-head">
        <div className="eyebrow">
          {business ? "BUSINESS PROFILE" : "RIDER PROFILE"}
        </div>
        <MemberAvatar
          user={{
            displayName: business?.name || profile.displayName,
            photoURL: business?.logoURL || profile.photoURL || null,
          }}
          size={80}
        />
        <h1>{business?.name || profile.displayName}</h1>
        <span className="seller-kind-badge">
          {sellerLabel(accountTypeOf(profile))} � self-declared
        </span>
        {business && (
          <div className="business-storefront">
            <p>{business.category}</p>
            <p>{business.description}</p>
            {business.website && (
              <p>
                <a
                  href={business.website}
                  rel="nofollow noopener noreferrer"
                  target="_blank"
                >
                  Business website
                </a>
              </p>
            )}
            {business.phone && <p>Telephone: {business.phone}</p>}
            {business.email && (
              <p>
                <a href={`mailto:${encodeURIComponent(business.email)}`}>
                  {business.email}
                </a>
              </p>
            )}
            {business.hours && <p>Hours: {business.hours}</p>}
          </div>
        )}
        <p>
          {[profile.city, provinces[profile.region as keyof typeof provinces]]
            .filter(Boolean)
            .join(", ") || "Location not shared"}{" "}
          · {sellerLabel(accountTypeOf(profile))} · Member since{" "}
          {new Date(profile.createdAt).getUTCFullYear()}
        </p>
        <p>{profile.bio}</p>
        <RatingBadge uid={id} />
        <FollowControls key={id} uid={id} />
      </div>
      <h2 id="listings">
        {business ? "For sale from this business" : "For sale from this rider"}
      </h2>
      {listings.empty ? (
        <Empty
          title="No active public listings."
          description="This member has no published adverts at the moment."
        />
      ) : (
        <ProfileListings
          key={id}
          uid={id}
          initial={listings.docs.map((d) => publicListing(d.data(), d.id))}
        />
      )}
      <MemberReviews uid={id} />
      <h2 className="section">Recent community discussions.</h2>
      {threads.empty ? (
        <p>No public discussions started by this member yet.</p>
      ) : (
        threads.docs.map((d) => (
          <article className="topic-row" key={d.id}>
            <Link href={`/forum/${d.id}`}>
              <h3>{d.data().title}</h3>
            </Link>
            <small>
              {new Date(d.data().createdAt).toLocaleDateString("en-ZA")}
            </small>
          </article>
        ))
      )}
    </section>
  );
}
