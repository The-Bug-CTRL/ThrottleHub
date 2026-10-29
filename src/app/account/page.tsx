"use client";
import { AdministratorTools, CustomerSupportSettings } from "@/components/support-notifications";
import { publicPhone } from "@/lib/public-phone";
import {
  AccountTypePicker,
  BusinessProfileFields,
} from "@/components/seller-account-fields";
import {
  accountTypeOf,
  emptyBusiness,
  businessSchema,
  type AccountType,
} from "@/lib/seller-account";
import { accountProfile } from "@/lib/profile-client";
import { MemberAvatar } from "@/components/member-avatar";
import { FollowControls } from "@/components/follow-controls";
import { confirmAction } from "@/components/ui/dialogs";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  doc,
  getDoc,
  orderBy,
  documentId,
  startAfter,
} from "firebase/firestore";
import { sendEmailVerification } from "firebase/auth";
import { db } from "@/lib/firebase";
import { changeListing } from "@/lib/listing-client";
import {
  canTransition,
  isHistorical,
  isPublicListing,
  listingHref,
  statusLabel,
} from "@/lib/listing-history";
import { Listing } from "@/lib/models";
import { useSession } from "@/components/session";
import { Card } from "@/components/card";
import {
  LayoutGrid,
  Heart,
  UserRound,
  MessageCircle,
  LifeBuoy,
  Megaphone,
  LogOut,
} from "lucide-react";

import { Empty } from "@/components/empty";
import { LoadingState } from "@/components/ui/primitives";
import { SellerListingStats } from "@/components/seller-listing-stats";
import { PromotionManager } from "@/components/promote-listing";
import { RatingBadge } from "@/components/member-reviews";
import { provinces } from "@/lib/marketplace";
import { brand } from "@/lib/config";
export default function Account() {
  const { user, loading, logout } = useSession();

  const [items, setItems] = useState<Listing[]>([]);
  const [favourites, setFavourites] = useState<Listing[]>([]);
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("listings");
  const [listingFilter, setListingFilter] = useState("all");
  const [busyListing, setBusyListing] = useState("");
  const [lastListingId, setLastListingId] = useState("");
  const [moreListings, setMoreListings] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [listingsReady, setListingsReady] = useState(false),
    [favouritesReady, setFavouritesReady] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>("personal");
  const [business, setBusiness] = useState({ ...emptyBusiness });
  const [profileReady, setProfileReady] = useState(false);
  const [profileOwner, setProfileOwner] = useState("");
  const [profileInfo, setProfileInfo] = useState({
    region: "",
    city: "",
    country: "ZA",
    sellerType: "private",
    photoURL: "",
    contactPhone: "",
    contactPhonePublic: false,
    businessContactsPublic: false,
    createdAt: Date.now(),
  });
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get("tab");
    if (requested === "favourites") setTab(requested);
  }, []);
  useEffect(() => {
    setProfileReady(false);
    setProfileOwner("");
    setBusiness({ ...emptyBusiness });
    setProfileInfo((p) => ({
      ...p,
      contactPhone: "",
      contactPhonePublic: false,
      businessContactsPublic: false,
    }));
    if (!user) return;
    let active = true;
    setProfileReady(false);
    getDocs(
      query(
        collection(db, "listings"),
        where("ownerId", "==", user.uid),
        orderBy(documentId()),
        limit(40),
      ),
    )
      .then((s) => {
        if (!active) return;
        setItems(s.docs.map((d) => ({ ...d.data(), id: d.id }) as Listing));
        setLastListingId(s.docs.at(-1)?.id || "");
        setMoreListings(s.docs.length === 40);
        setListingsReady(true);
      })
      .catch(() => setNotice("Unable to load listings. Please retry."));

    accountProfile(user)
      .then((result) => {
        if (!active) return;
        if (result.needsSetup) {
          setNotice(
            "Your sign-in worked. Finish setting up your profile to continue.",
          );
          return;
        }
        const p = result.profile;
        setProfileOwner(user.uid);
        setProfileReady(true);
        setAccountType(accountTypeOf(p));
        setBusiness({ ...emptyBusiness, ...p.business });
        setName(p.displayName || user.displayName || "");
        setBio(p.bio || "");
        setProfileInfo({
          region: p.region || "",
          city: p.city || "",
          country: p.country || "ZA",
          sellerType: p.sellerType || "private",
          photoURL: p.photoURL || "",
          contactPhone: p.contactPhone || "",
          contactPhonePublic: p.contactPhonePublic === true,
          businessContactsPublic: p.businessContactsPublic === true,
          createdAt: p.createdAt,
        });
      })
      .catch((error) => {
        if (active) setNotice(error.message);
      });
    getDocs(query(collection(db, "users", user.uid, "favourites"), limit(40)))
      .then(async (s) => {
        const docs = await Promise.all(
          s.docs.map((d) =>
            getDoc(doc(db, "listings", d.id)).catch(() => null),
          ),
        );
        if (!active) return;
        setFavourites(
          docs
            .filter((d): d is NonNullable<typeof d> =>
              Boolean(
                d?.exists() &&
                d.data()?.country === "ZA" &&
                d.data()?.currency === "ZAR",
              ),
            )
            .map((d) => ({ ...d.data(), id: d.id }) as Listing),
        );
        setFavouritesReady(true);
      })
      .catch(() => setNotice("Some saved listings are no longer public."));
    return () => {
      active = false;
    };
  }, [user]);
  if (loading)
    return (
      <div className="wrap">
        <LoadingState label="Loading your garage…" />
      </div>
    );
  if (!user)
    return (
      <div className="auth-panel">
        <h1>Your garage, organised.</h1>
        <p>Sign in to manage listings, favourites and your profile.</p>
        <Link className="button" href="/auth">
          Sign in
        </Link>
      </div>
    );
  return (
    <section className="wrap section">
      <div className="eyebrow">YOUR GARAGE</div>
      <RatingBadge uid={user.uid} />
      <Link className="text-button" href={`/seller/${user.uid}`}>
        View my public profile
      </Link>
      <FollowControls uid={user.uid} />
      <Link className="text-button" href="/account/saved-searches">
        Saved searches
      </Link>
      <div className="account-avatar">
        <MemberAvatar
          user={{
            photoURL: user.photoURL,
            displayName: name || user.displayName,
          }}
          size={56}
        />
        <div>
          <h1>Your garage, organised.</h1>
          <p>
            Welcome back, {name || user.displayName || "rider"}.
          </p>
        </div>
      </div>
      {!user.emailVerified && (
        <div className="notice">
          Email not verified.{" "}
          <button
            onClick={async () => {
              await sendEmailVerification(user);
              setNotice(
                "Verification requested; see emulator terminal for the link.",
              );
            }}
          >
            Send verification link
          </button>
        </div>
      )}
      <div className="account-layout">
        <aside className="account-nav" aria-label="Account navigation">
          <div className="account-nav-links">
          <h2 className="account-nav-heading">Main account options</h2>
          {[
            ["listings", "My Listings", LayoutGrid],
            ["favourites", "Saved Favourites", Heart],
            ["profile", "Profile & Settings", UserRound],
          ].map(([value, label, Icon]) => {
            const t = String(value);
            const I = Icon as typeof Heart;
            return (
              <button
                className={tab === t ? "active" : ""}
                key={t}
                onClick={() => setTab(t)}
                aria-pressed={tab === t}
              >
                <I size={17} />
                {String(label)}
              </button>
            );
          })}
          <Link href="/messages">
            <MessageCircle size={17} />
            Messages
          </Link>
          <Link href="/account/promotions"><Megaphone size={17} /> Promotion Purchases</Link>



          <Link href={`/seller/${user.uid}`}>
            <UserRound size={17} /> Public Profile &amp; Reviews
          </Link>
          <Link href={`/seller/${user.uid}/connections?tab=following`}>
            <Heart size={17} /> Following &amp; Followers
          </Link>
          </div>
          <section className="account-nav-section account-nav-links" aria-labelledby="account-help-title"><h2 id="account-help-title" className="account-nav-heading">Help</h2><Link href="/help"><LifeBuoy size={17} /> Help &amp; Support</Link></section>
          <AdministratorTools />
          <div className="account-nav-final">
          <button onClick={logout}>
            <LogOut size={17} />
            Sign Out
          </button>
          </div>
        </aside>
        <div>
          <CustomerSupportSettings />
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          {tab === "listings" && (
            <>
              <div className="section-heading">
                <div>
                  <h2>My listings</h2>
                  <p>Create, edit and manage the items in your garage.</p>
                </div>
                <Link className="button" href="/sell">
                  Create a listing
                </Link>
              </div>
              {!listingsReady && !notice && (
                <LoadingState label="Loading your listings…" />
              )}
              <label>
                Listing status
                <select
                  value={listingFilter}
                  onChange={(e) => setListingFilter(e.target.value)}
                >
                  {[
                    "all",
                    "published",
                    "sold",
                    "expired",
                    "on-hold",
                    "draft",
                    "rejected",
                    "hidden",
                    "removed",
                  ].map((status) => (
                    <option key={status} value={status}>
                      {status === "all" ? "All statuses" : statusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                Sold, expired and on-hold adverts keep their original links.{" "}
                <Link href="/policies/history">History and removal policy</Link>
              </p>
              <div className="listing-grid section">
                {items
                  .filter(
                    (l) =>
                      listingFilter === "all" || l.status === listingFilter,
                  )
                  .map((l) => (
                    <div key={l.id}>
                      {l.status === "removed" ? (
                        <p>Advert removed. Photo cleanup is pending.</p>
                      ) : (
                        <Card listing={l} />
                      )}
                      {l.status !== "removed" && (
                        <SellerListingStats id={l.id} user={user} />
                      )}
                      <div className="manage-row">
                        <PromotionManager
                          user={user}
                          listingId={l.id}
                          eligible={l.status === "published"}
                        />
                        <span>{statusLabel(l.status)}</span>
                        {isPublicListing(l) && (
                          <Link href={listingHref(l)}>
                            {isHistorical(l)
                              ? "View historical listing"
                              : "View listing"}
                          </Link>
                        )}
                        {(["draft", "published"].includes(l.status) ||
                          (l.primaryCategoryId === "motorcycles" &&
                            ["expired", "on-hold"].includes(l.status))) && (
                          <Link href={`/sell?edit=${l.id}`}>Edit</Link>
                        )}
                        {(
                          [
                            "published",
                            "sold",
                            "on-hold",
                            "expired",
                            "removed",
                          ] as const
                        )
                          .filter(
                            (status) =>
                              canTransition(l.status, status) ||
                              (l.status === "removed" && status === "removed"),
                          )
                          .map((status) => (
                            <button
                              key={status}
                              disabled={busyListing === l.id}
                              onClick={async () => {
                                const prompt =
                                  status === "removed"
                                    ? "Remove this advert and all its photos from public access? Sold adverts can instead remain as useful history. Removal cannot be undone and does not erase private conversations."
                                    : `Change this advert to ${statusLabel(status)}? Sold adverts stay accessible as history and cannot be edited or relisted.`;
                                if (!(await confirmAction(prompt))) return;
                                setBusyListing(l.id);
                                try {
                                  const result = await changeListing(
                                    user,
                                    l.id,
                                    { action: "status", status },
                                  );
                                  setItems((old) =>
                                    status === "removed" &&
                                    !result.cleanupPending
                                      ? old.filter((x) => x.id !== l.id)
                                      : old.map((x) =>
                                          x.id === l.id ? { ...x, status } : x,
                                        ),
                                  );
                                  setNotice(
                                    result.warning ||
                                      (status === "removed"
                                        ? "Advert and photos removed."
                                        : "Listing updated. Its original link is preserved."),
                                  );
                                } catch (error) {
                                  setNotice(
                                    error instanceof Error
                                      ? error.message
                                      : "Unable to update listing.",
                                  );
                                } finally {
                                  setBusyListing("");
                                }
                              }}
                            >
                              {status === "removed"
                                ? l.status === "removed"
                                  ? "Retry photo removal"
                                  : "Remove advert"
                                : status === "published"
                                  ? l.status === "draft"
                                    ? "Publish"
                                    : "Reactivate same item"
                                  : `Mark ${statusLabel(status).toLowerCase()}`}
                            </button>
                          ))}
                      </div>
                    </div>
                  ))}
              </div>
              {listingsReady && !items.length && (
                <Empty
                  title="A little space in the garage."
                  description="You haven’t created a listing yet. Give your bike, parts or riding kit a fresh start."
                  href="/sell"
                  label="Create your first listing"
                />
              )}
              <small>
                Showing {items.length} loaded adverts. Status filters apply to
                loaded adverts.
              </small>
              {moreListings && (
                <button
                  className="button"
                  disabled={loadingMore}
                  onClick={async () => {
                    setLoadingMore(true);
                    try {
                      const page = await getDocs(
                        query(
                          collection(db, "listings"),
                          where("ownerId", "==", user.uid),
                          orderBy(documentId()),
                          startAfter(lastListingId),
                          limit(40),
                        ),
                      );
                      setItems((old) => [
                        ...old,
                        ...page.docs.map(
                          (d) => ({ ...d.data(), id: d.id }) as Listing,
                        ),
                      ]);
                      setLastListingId(page.docs.at(-1)?.id || lastListingId);
                      setMoreListings(page.docs.length === 40);
                    } catch {
                      setNotice("Unable to load more adverts. Please retry.");
                    } finally {
                      setLoadingMore(false);
                    }
                  }}
                >
                  {loadingMore ? "Loading…" : "Load more adverts"}
                </button>
              )}
            </>
          )}
          {tab === "favourites" && (
            <>
              <div className="section-heading">
                <div>
                  <h2>Saved for the next ride.</h2>
                  <p>Keep the items you’re considering in one place.</p>
                </div>
              </div>
              <div className="listing-grid">
                {!favouritesReady && !notice ? (
                  <LoadingState label="Loading your saved items…" />
                ) : favourites.length ? (
                  favourites.map((l) => <Card key={l.id} listing={l} />)
                ) : (
                  favouritesReady && (
                    <Empty
                      title="Something will catch your eye."
                      description="Tap the heart on a listing to keep it here for later."
                      href="/browse"
                      label="Explore the marketplace"
                    />
                  )
                )}
              </div>
            </>
          )}
          {tab === "profile" &&
            (!profileReady || profileOwner !== user.uid) && (
              <p role="status">Loading your private profile details…</p>
            )}
          {tab === "profile" && profileReady && profileOwner === user.uid && (
            <form
              className="profile-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!profileReady) {
                  setNotice("Wait for your profile to load before saving.");
                  return;
                }
                if (
                  profileInfo.contactPhone.trim() &&
                  !publicPhone({
                    contactPhone: profileInfo.contactPhone,
                    contactPhonePublic: true,
                  })
                ) {
                  setNotice(
                    "Enter a phone number with 7–15 digits, optionally starting with +.",
                  );
                  return;
                }
                try {
                  await accountProfile(
                    user,
                    {
                      displayName: name.slice(0, 80),
                      bio: bio.slice(0, 600),
                      region: profileInfo.region,
                      city: profileInfo.city,
                      country: profileInfo.country,
                      photoURL: profileInfo.photoURL,
                      contactPhone: profileInfo.contactPhone,
                      accountType,
                      ...(accountType === "business"
                        ? { business: businessSchema.parse(business) }
                        : {}),
                    },
                    true,
                  );
                  setNotice("Public profile saved.");
                } catch {
                  setNotice("Unable to save profile.");
                }
              }}
            >
              <h2>A little about you.</h2>
              <AccountTypePicker
                value={accountType}
                onChange={setAccountType}
              />
              {accountType === "business" && (
                <BusinessProfileFields
                  value={business}
                  onChange={setBusiness}
                />
              )}
              <label>
                Public profile photo URL (HTTPS)
                <input
                  type="url"
                  value={profileInfo.photoURL}
                  onChange={(e) =>
                    setProfileInfo((p) => ({ ...p, photoURL: e.target.value }))
                  }
                />
              </label>
              <p>
                Your profile is public. Your email address and account details
                stay private.
              </p>
              <label>
                Public display name
                <input
                  minLength={2}
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <div className="field-row">
                <label>
                  Home country
                  <select
                    value={profileInfo.country}
                    onChange={(e) =>
                      setProfileInfo((p) => ({ ...p, country: e.target.value }))
                    }
                  >
                    {Object.entries(brand.countries)
                      .filter(([code]) => code !== "global")
                      .map(([code, label]) => (
                        <option key={code} value={code}>
                          {label}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Province
                  <select
                    value={profileInfo.region}
                    onChange={(e) =>
                      setProfileInfo((p) => ({ ...p, region: e.target.value }))
                    }
                  >
                    <option value="">Not shared</option>
                    {Object.entries(provinces).map(([code, name]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  City / general area
                  <input
                    value={profileInfo.city}
                    maxLength={80}
                    onChange={(e) =>
                      setProfileInfo((p) => ({ ...p, city: e.target.value }))
                    }
                  />
                </label>
              </div>
              <label>
                Seller type
                <select
                  value={accountType === "business" ? "dealer" : "private"}
                  onChange={(e) =>
                    setAccountType(
                      e.target.value === "dealer" ? "business" : "personal",
                    )
                  }
                >
                  <option value="private">Private seller</option>
                  <option value="dealer">Business Seller</option>
                </select>
                <small>
                  This is a self-declared seller type, not a verification badge.
                </small>
              </label>
              <label>
                Biography
                <textarea
                  maxLength={600}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </label>
              <label>
                Contact phone number (private unless you choose to share)
                <input
                  type="tel"
                  maxLength={40}
                  value={profileInfo.contactPhone}
                  onChange={(e) =>
                    setProfileInfo((p) => ({
                      ...p,
                      contactPhone: e.target.value,
                    }))
                  }
                  placeholder="e.g. +27 82 123 4567"
                />
                <small>
                  Kept private by default. Choose below if buyers may see it.
                </small>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={profileInfo.contactPhonePublic}
                  onChange={(e) =>
                    setProfileInfo((p) => ({
                      ...p,
                      contactPhonePublic: e.target.checked,
                    }))
                  }
                />
                Show my contact phone publicly on adverts
              </label>
              {accountType === "business" && (
                <label>
                  <input
                    type="checkbox"
                    checked={profileInfo.businessContactsPublic}
                    onChange={(e) =>
                      setProfileInfo((p) => ({
                        ...p,
                        businessContactsPublic: e.target.checked,
                      }))
                    }
                  />
                  Show my business phone and email publicly
                </label>
              )}
              <button className="button" disabled={!profileReady}>
                Save profile
              </button>
              <p>
                Private email addresses are never included in public profiles.
              </p>
              <p className="notice">
                Account deletion and data export requests require a support
                process before beta. Self-service export and deletion are not
                yet implemented.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
