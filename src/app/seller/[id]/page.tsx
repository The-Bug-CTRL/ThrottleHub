import { provinces } from "@/lib/marketplace";
import { FieldPath } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server";
import { Listing } from "@/lib/models";
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
  const profile = p.docs[0].data();
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
        <div className="eyebrow">RIDER PROFILE</div>
        <MemberAvatar
          user={{
            displayName: profile.displayName,
            photoURL: profile.photoURL || null,
          }}
          size={80}
        />
        <h1>{profile.displayName}</h1>
        <p>
          {[profile.city, provinces[profile.region as keyof typeof provinces]]
            .filter(Boolean)
            .join(", ") || "Location not shared"}{" "}
          · {profile.sellerType} seller · Member since{" "}
          {new Date(profile.createdAt).getUTCFullYear()}
        </p>
        <p>{profile.bio}</p>
        <RatingBadge uid={id} />
        <FollowControls key={id} uid={id} />
      </div>
      <h2 id="listings">For sale from this rider</h2>
      {listings.empty ? (
        <Empty
          title="No active public listings."
          description="This member has no published adverts at the moment."
        />
      ) : (
        <ProfileListings
          key={id}
          uid={id}
          initial={listings.docs.map(
            (d) => ({ ...d.data(), id: d.id }) as Listing,
          )}
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
