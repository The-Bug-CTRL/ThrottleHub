"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Star, MessageSquare, Flag } from "lucide-react";
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSession } from "./session";
import {
  MemberReview,
  ReviewSummary,
  emptyReviewSummary,
  reviewSchema,
} from "@/lib/reviews";
import { requestText } from "./ui/dialogs";
import { dataError } from "@/lib/errors";
export function Stars({ rating }: { rating: number }) {
  return (
    <span
      className="rating-stars"
      role="img"
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          aria-hidden="true"
          key={star}
          size={17}
          fill={rating >= star ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}
export function RatingBadge({ uid }: { uid: string }) {
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  useEffect(() => {
    let active = true;
    setSummary(null);
    function refresh() {
      fetch(`/api/profiles/${encodeURIComponent(uid)}/reviews?summary=1`)
        .then((r) => {
          if (!r.ok) throw Error();
          return r.json();
        })
        .then((d) => {
          if (active) setSummary(d.summary);
        })
        .catch(() => {});
    }
    function changed(event: Event) {
      if ((event as CustomEvent).detail === uid) refresh();
    }
    refresh();
    window.addEventListener("member-reviews-updated", changed);
    return () => {
      active = false;
      window.removeEventListener("member-reviews-updated", changed);
    };
  }, [uid]);
  return (
    <Link className="rating-badge" href={`/seller/${uid}#reviews`}>
      {summary ? (
        <>
          <Stars rating={summary.average} />
          <span>
            {summary.count
              ? `${summary.average.toFixed(1)} - ${summary.count} review${summary.count === 1 ? "" : "s"}`
              : "No reviews yet"}
          </span>
        </>
      ) : (
        "View member reviews"
      )}
    </Link>
  );
}
type Interaction = {
  id: string;
  listingId: string;
  listingTitle: string;
  role: "buyer" | "seller";
  authorMessageId: string;
  subjectMessageId: string;
};
export function MemberReviews({ uid }: { uid: string }) {
  const { user, loading } = useSession();
  const [reviews, setReviews] = useState<MemberReview[]>([]),
    [summary, setSummary] = useState(emptyReviewSummary),
    [next, setNext] = useState<string | null>(null);
  const [busy, setBusy] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [own, setOwn] = useState<MemberReview | null>(null),
    [interactions, setInteractions] = useState<Interaction[]>([]),
    [eligibleBusy, setEligibleBusy] = useState(false),
    [eligibilityError, setEligibilityError] = useState("");
  const [rating, setRating] = useState(0),
    [body, setBody] = useState(""),
    [selected, setSelected] = useState("");
  const load = useCallback(
    async (after?: string) => {
      setBusy(true);
      setError("");
      try {
        const r = await fetch(
          `/api/profiles/${encodeURIComponent(uid)}/reviews${after ? `?after=${encodeURIComponent(after)}` : ""}`,
        );
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        setReviews((old) => (after ? [...old, ...data.reviews] : data.reviews));
        setSummary(data.summary);
        setNext(data.next);
      } catch (e) {
        setError(dataError(e));
      } finally {
        setBusy(false);
      }
    },
    [uid],
  );
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    let active = true;
    setOwn(null);
    setInteractions([]);
    setRating(0);
    setBody("");
    setEligibilityError("");
    setSelected("");
    setEligibleBusy(false);
    if (!user || user.uid === uid) return;
    setEligibleBusy(true);
    (async () => {
      const existing = await getDoc(
        doc(db, "profiles", uid, "reviews", user.uid),
      );
      if (existing.exists()) {
        const d = existing.data();
        if (active) {
          setOwn({ ...d, id: existing.id } as MemberReview);
          setRating(d.rating);
          setBody(d.body);
        }
        return;
      }
      // Query both participants; private message contents are never included in reviews.
      const pages = await Promise.all(
        ["buyerId", "sellerId"].map((field) =>
          getDocs(
            query(
              collection(db, "conversations"),
              where("participants", "array-contains", user.uid),
              where(field, "==", uid),
            ),
          ),
        ),
      );
      const conversations = { docs: pages.flatMap((page) => page.docs) };
      const eligible: Interaction[] = [];
      for (const c of conversations.docs) {
        const d = c.data();
        if (
          ![d.buyerId, d.sellerId].includes(uid) ||
          ![d.buyerId, d.sellerId].includes(user.uid)
        )
          continue;
        const [mine, theirs] = await Promise.all([
          getDocs(
            query(
              collection(c.ref, "messages"),
              where("senderId", "==", user.uid),
              limit(1),
            ),
          ),
          getDocs(
            query(
              collection(c.ref, "messages"),
              where("senderId", "==", uid),
              limit(1),
            ),
          ),
        ]);
        if (!mine.empty && !theirs.empty)
          eligible.push({
            id: c.id,
            listingId: d.listingId,
            listingTitle: d.listingTitle,
            role: d.buyerId === user.uid ? "buyer" : "seller",
            authorMessageId: mine.docs[0].id,
            subjectMessageId: theirs.docs[0].id,
          });
      }
      if (active) {
        setInteractions(eligible);
        setSelected(eligible[0]?.id || "");
      }
    })()
      .catch((e) => {
        if (active) setEligibilityError(dataError(e));
      })
      .finally(() => {
        if (active) setEligibleBusy(false);
      });
    return () => {
      active = false;
    };
  }, [user, uid]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user || saving) return;
    setSaving(true);
    setNotice("");
    try {
      const parsed = reviewSchema.safeParse({ rating, body });
      if (!parsed.success)
        throw Error(parsed.error.issues[0]?.message || "Check your review.");
      const values = parsed.data;
      const ref = doc(db, "profiles", uid, "reviews", user.uid);
      if (own)
        await updateDoc(ref, { ...values, updatedAt: serverTimestamp() });
      else {
        const interaction = interactions.find((c) => c.id === selected);
        if (!interaction)
          throw Error("Choose an eligible marketplace conversation.");
        const profile = await getDoc(doc(db, "profiles", user.uid));
        if (!profile.exists())
          throw Error(
            "Please complete your public profile in My account first.",
          );
        await setDoc(ref, {
          ...values,
          authorId: user.uid,
          subjectId: uid,
          authorName: profile.data().displayName,
          listingId: interaction.listingId,
          listingTitle: interaction.listingTitle,
          conversationId: interaction.id,
          role: interaction.role,
          authorMessageId: interaction.authorMessageId,
          subjectMessageId: interaction.subjectMessageId,
          status: "published",
          response: "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setOwn({
        id: user.uid,
        rating: values.rating,
        body: values.body,
        status: "published",
      } as MemberReview);
      setNotice("Your review has been saved.");
      window.dispatchEvent(
        new CustomEvent("member-reviews-updated", { detail: uid }),
      );
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Unable to save review.");
    } finally {
      setSaving(false);
    }
  }
  async function report(review: MemberReview) {
    if (!user) return;
    const reason = await requestText(
      "Why should a moderator review this feedback? (at least 10 characters)",
    );
    if (!reason) return;
    if (reason.trim().length < 10) {
      setNotice("Please provide at least 10 characters.");
      return;
    }
    try {
      await setDoc(doc(db, "reviewFlags", `${uid}_${review.id}_${user.uid}`), {
        targetId: uid,
        replyId: review.id,
        reporterId: user.uid,
        reason: reason.slice(0, 1500),
        status: "open",
        createdAt: Date.now(),
      });
      setNotice("Review reported to the moderation team.");
    } catch (e) {
      setNotice(dataError(e));
    }
  }
  async function respond(review: MemberReview) {
    const response = await requestText(
      "Reply to this review",
      review.response || "",
    );
    if (response === null) return;
    try {
      await updateDoc(doc(db, "profiles", uid, "reviews", review.id), {
        response: response.trim().slice(0, 1000),
        updatedAt: serverTimestamp(),
      });
      await load();
    } catch (e) {
      setNotice(dataError(e));
    }
  }
  return (
    <section
      id="reviews"
      className="member-reviews"
      aria-labelledby="reviews-heading"
    >
      <div className="section-heading">
        <div>
          <div className="eyebrow">Rider reputation</div>
          <h2 id="reviews-heading">Ratings & reviews</h2>
          <p>
            Feedback from members who have exchanged messages about a listing.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="notice error">
          {error}{" "}
          <button className="text-button" onClick={() => load()}>
            Try again
          </button>
        </p>
      )}
      <div className="review-layout">
        <aside className="review-summary">
          <strong>{summary.count ? summary.average.toFixed(1) : "-"}</strong>
          <Stars rating={summary.average} />
          <p>
            {summary.count} {summary.count === 1 ? "review" : "reviews"}
          </p>
          {[5, 4, 3, 2, 1].map((star) => (
            <div className="review-bar" key={star}>
              <span>
                {star} <Star size={12} aria-hidden="true" />
              </span>
              <meter
                aria-label={`${star} star reviews`}
                min={0}
                max={Math.max(summary.count, 1)}
                value={summary.distribution[star - 1]}
              />
              <span>{summary.distribution[star - 1]}</span>
            </div>
          ))}
          <small>
            Messaging confirms an interaction, not a completed purchase.
          </small>
        </aside>
        <div className="review-content">
          {loading || eligibleBusy ? (
            <p role="status">Checking review eligibility...</p>
          ) : !user ? (
            <p>
              <Link href="/auth">Sign in</Link> to leave a review after a
              marketplace conversation.
            </p>
          ) : user.uid === uid ? (
            <p>
              These are the reviews other riders have left for you. You can
              reply below.
            </p>
          ) : eligibilityError ? (
            <p role="alert" className="notice error">
              {eligibilityError}
            </p>
          ) : own?.status === "hidden" ? (
            <p className="notice">
              Your review is under moderation and cannot be edited.
            </p>
          ) : own || interactions.length ? (
            <form className="review-form" onSubmit={submit}>
              <h3>{own ? "Edit your review" : "Write a review"}</h3>
              {!own && (
                <label>
                  Marketplace interaction
                  <select
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    required
                  >
                    {interactions.map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.listingTitle} - You were the {c.role}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <fieldset className="rating-picker">
                <legend>Your rating</legend>
                {[1, 2, 3, 4, 5].map((star) => (
                  <label key={star}>
                    <input
                      type="radio"
                      name="rating"
                      value={star}
                      checked={rating === star}
                      onChange={() => setRating(star)}
                      required
                    />
                    <Star
                      size={26}
                      fill={rating >= star ? "currentColor" : "none"}
                      aria-hidden="true"
                    />
                    <span className="sr-only">
                      {star} {star === 1 ? "star" : "stars"}
                    </span>
                  </label>
                ))}
              </fieldset>
              <label>
                Your experience
                <textarea
                  minLength={20}
                  maxLength={2000}
                  required
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Describe your experience with this member."
                />
              </label>
              <small>
                {body.length}/2000 - One review per member. You can update it
                later.
              </small>
              <button className="button" disabled={saving}>
                {saving
                  ? "Saving..."
                  : own
                    ? "Update review"
                    : "Publish review"}
              </button>
            </form>
          ) : (
            <p className="notice">
              You can review this member after you have both sent messages in a
              listing conversation.
            </p>
          )}
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          {!busy && !error && !reviews.length && (
            <p>
              No reviews yet. This member&apos;s reputation will grow with the
              community.
            </p>
          )}
          {reviews.map((review) => (
            <article className="member-review" key={review.id}>
              <header>
                <div>
                  <Link href={`/seller/${review.authorId}`}>
                    <b>{review.authorName}</b>
                  </Link>
                  <small>
                    Reviewed as a {review.role} -{" "}
                    {new Date(review.createdAt).toLocaleDateString("en-ZA")}
                  </small>
                </div>
                <Stars rating={review.rating} />
              </header>
              <p className="description">{review.body}</p>
              <small>About: {review.listingTitle}</small>
              {review.response && (
                <blockquote>
                  <b>Member&apos;s reply</b>
                  <p className="description">{review.response}</p>
                </blockquote>
              )}
              <div className="review-actions">
                {user?.uid === uid && (
                  <button
                    className="text-button"
                    onClick={() => respond(review)}
                  >
                    <MessageSquare size={14} />
                    {review.response ? "Edit reply" : "Reply"}
                  </button>
                )}
                {user && user.uid !== review.authorId && (
                  <button
                    className="text-button"
                    onClick={() => report(review)}
                  >
                    <Flag size={14} />
                    Report review
                  </button>
                )}
              </div>
            </article>
          ))}
          {busy && <p role="status">Loading reviews...</p>}
          {next && (
            <button
              className="button-secondary"
              disabled={busy}
              onClick={() => load(next)}
            >
              Load more reviews
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
