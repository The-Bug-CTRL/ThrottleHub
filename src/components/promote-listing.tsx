"use client";
import { useEffect, useId, useRef, useState, useCallback } from "react";
import type { User } from "firebase/auth";
import { X, TrendingUp } from "lucide-react";
import { promotionRequest } from "@/lib/promotion-client";
import { useSession } from "./session";
type Product = {
  sku: string;
  name: string;
  amount: number;
  durationDays: number;
};
type Order = {
  listingId: string;
  reference: string;
  sku: string;
  productName: string;
  amount: number;
  status: string;
  environment: string;
  featuredUntil?: number;
  createdAt: number;
  reviewRequired?: boolean;
  reviewReason?: string;
};
type Feed = {
  environment: string;
  enabled: boolean;
  bumpCooldownHours: number;
  products: Product[];
  orders: Order[];
  next: string | null;
  promotion: {
    featuredUntil: number | null;
    bumpedAt: number | null;
    bumpEligibleAt: number | null;
  } | null;
};
const price = (amount: number) => `R${(amount / 100).toFixed(2)}`;
function statusText(status: string) {
  return (
    (
      {
        fulfilled: "Payment verified; promotion delivered.",
        paid_needs_review:
          "Payment received, but placement could not be delivered. Refund/manual review is required.",
        pending: "Payment has not been confirmed yet.",
        initializing: "Preparing checkout.",
        initialization_unknown:
          "Checkout preparation needs verification. Check again before retrying.",
        failed: "Payment failed. No promotion was activated.",
        abandoned:
          "Checkout was not completed. A later payment can still be verified.",
        cancelled:
          "Checkout cancelled here. Any payment completing separately will still be checked.",
        refunded: "Refund recorded; promotion benefits revoked.",
        reversed:
          "Payment reversed; promotion benefits revoked. Support review is required.",
        reversal_pending_review:
          "A refund or dispute notice was received. Placement is suspended while it is checked.",
        refund_pending: "Refund is pending; placement is suspended.",
        refund_processed_review:
          "A refund was processed, but its amount needs support review. Placement remains suspended.",
        refund_failed_review: "Refund failed; support review is required.",
        disputed: "Payment disputed; placement is suspended.",
        dispute_resolved_review:
          "Dispute resolved; support review is required before further action.",
        review_required:
          "Payment details need review. No new placement was granted.",
      } as Record<string, string>
    )[status] || status.replaceAll("_", " ")
  );
}
export function PromotionManager({
  user,
  listingId,
  eligible = true,
}: {
  user: User;
  listingId: string;
  eligible?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="text-button"
        onClick={() => setOpen(true)}
      >
        <TrendingUp size={15} />
        {eligible ? "Promote Listing" : "Promotion history"}
      </button>
      {open && (
        <PromotionDialog
          key={`${user.uid}:${listingId}`}
          user={user}
          listingId={listingId}
          eligible={eligible}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
function PromotionDialog({
  user,
  listingId,
  eligible,
  onClose,
}: {
  user: User;
  listingId: string;
  eligible: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    title = useId();
  const actionPending = useRef(false);
  const [feed, setFeed] = useState<Feed | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const element = dialog.current,
      previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    let active = true;
    promotionRequest(
      user,
      undefined,
      `?listingId=${encodeURIComponent(listingId)}`,
    )
      .then((result) => {
        if (active) setFeed(result);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
      element?.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [user, listingId]);
  async function action(body: unknown) {
    if (actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await promotionRequest(user, body);
      if (result.url) {
        const url = new URL(result.url);
        if (
          url.protocol !== "https:" ||
          url.hostname !== "checkout.paystack.com" ||
          url.username ||
          url.password ||
          url.port
        )
          throw Error("Invalid checkout address.");
        window.location.assign(url.href);
        return;
      }
      setMessage(statusText(result.status));
      setFeed(
        await promotionRequest(
          user,
          undefined,
          `?listingId=${encodeURIComponent(listingId)}`,
        ),
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Promotions are unavailable.",
      );
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="promotion-dialog"
      aria-labelledby={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2 id={title}>Promote your listing</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close promotions"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </header>
      {!feed && !error && <p role="status">Loading promotions…</p>}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {feed && (
        <>
          {feed.environment === "test" && (
            <p className="notice">
              <b>TEST checkout.</b> No live payment or live paid placement. Test
              preview, when enabled locally, is labelled separately.
            </p>
          )}
          {!feed.enabled && <p>Promotions are not available yet.</p>}
          <p>
            Paid placement can increase visibility. Views, enquiries and a sale
            are not guaranteed.
          </p>
          <p>
            Placement applies while your advert is published. Selling, holding
            or removing it stops placement; expiry dates do not pause.
          </p>
          {feed.promotion?.featuredUntil && (
            <p>
              <b>
                Featured until{" "}
                {new Date(feed.promotion.featuredUntil).toLocaleString("en-ZA")}
              </b>
            </p>
          )}
          {feed.promotion?.bumpedAt && (
            <p>
              Last bump:{" "}
              {new Date(feed.promotion.bumpedAt).toLocaleString("en-ZA")}
            </p>
          )}
          {eligible && (
            <div className="promotion-products">
              {feed.products.map((product) => (
                <article key={product.sku}>
                  <h3>{product.name}</h3>
                  <strong>{price(product.amount)}</strong>
                  <p>
                    {product.durationDays
                      ? `Featured placement for ${product.durationDays} days.`
                      : `Move up the newest-listings order. New listings and later bumps can move above yours. ${feed.bumpCooldownHours} hours between paid bumps.`}
                  </p>
                  {product.sku === "bump" && (feed.promotion?.bumpEligibleAt || 0) > Date.now() && <p>Available after {new Date(feed.promotion!.bumpEligibleAt!).toLocaleString("en-ZA")}.</p>}
                  {product.sku !== "bump" && !!feed.promotion?.featuredUntil && <p>This advert already has an active featured placement.</p>}
                  <button
                    className="button"
                    disabled={
                      busy ||
                      !feed.enabled ||
                      (product.sku === "bump"
                        ? (feed.promotion?.bumpEligibleAt || 0) > Date.now()
                        : !!feed.promotion?.featuredUntil)
                    }
                    onClick={() =>
                      void action({
                        action: "initialize",
                        listingId,
                        sku: product.sku,
                      })
                    }
                  >
                    Continue to checkout
                  </button>
                </article>
              ))}
            </div>
          )}
          <h3>Previous purchases</h3>
          {!feed.orders.length && (
            <p>No promotion purchases for this listing.</p>
          )}
          {feed.orders.map((order) => (
            <article className="promotion-order" key={order.reference}>
              <b>
                {order.productName} · {price(order.amount)} ·{" "}
                {order.environment.toUpperCase()}
              </b>
              <p>{statusText(order.status)}</p>
              {order.reviewRequired && (
                <p>
                  Contact support with reference <code>{order.reference}</code>.
                  Keep this reference for refund or dispute queries.
                </p>
              )}
              <small>{new Date(order.createdAt).toLocaleString("en-ZA")}</small>
              {!["refunded", "disputed"].includes(order.status) && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void action({
                      action: "verify",
                      reference: order.reference,
                    })
                  }
                >
                  Check payment
                </button>
              )}
              {[
                "initializing",
                "pending",
                "initialization_unknown",
                "abandoned",
              ].includes(order.status) && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void action({
                      action: "cancel",
                      reference: order.reference,
                    })
                  }
                >
                  Cancel checkout
                </button>
              )}
            </article>
          ))}
          {feed.next && (
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const next: Feed = await promotionRequest(
                    user,
                    undefined,
                    `?listingId=${encodeURIComponent(listingId)}&after=${feed.next}`,
                  );
                  setFeed({
                    ...next,
                    orders: [...feed.orders, ...next.orders],
                  });
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "History unavailable.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              More purchases
            </button>
          )}
        </>
      )}
    </dialog>
  );
}
export function PromotionCallback() {
  const [hasReference, setHasReference] = useState(false);
  useEffect(() => {
    setHasReference(
      new URLSearchParams(window.location.search).has("reference"),
    );
  }, []);
  const [message, setMessage] = useState(
      "Sign in to verify this payment from your account.",
    ),
    [error, setError] = useState("");
  if (!hasReference) return null;
  return (
    <div data-promotion-callback>
      <p>{message}</p>
      <CallbackVerifier setMessage={setMessage} setError={setError} />
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <a href="/account">Your listings and promotion history</a>
    </div>
  );
}
export function PromotionHistory() {
  const { user, loading } = useSession();
  if (!user)
    return loading ? (
      <p>Loading account…</p>
    ) : (
      <a href="/auth">Sign in to view purchases</a>
    );
  return <HistoryForUser key={user.uid} user={user} />;
}
function HistoryForUser({ user }: { user: User }) {
  const [orders, setOrders] = useState<Order[]>([]),
    [error, setError] = useState(""),
    [next, setNext] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const load = useCallback(
    async (after?: string) => {
      if (!user) return;
      setBusy(true);
      setError("");
      try {
        const result = await promotionRequest(
          user,
          undefined,
          after ? `?after=${after}` : "",
        );
        setOrders((old) =>
          after ? [...old, ...result.orders] : result.orders,
        );
        setNext(result.next);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "History unavailable.",
        );
      } finally {
        setBusy(false);
      }
    },
    [user],
  );
  useEffect(() => {
    setOrders([]);
    setNext(null);
    if (user) void load();
  }, [user, load]);
  return (
    <div>
      <h2>Your promotion purchases</h2>
      {busy && <p role="status">Loading purchases…</p>}
      {error && (
        <p className="notice error" role="alert">
          {error} <button onClick={() => void load()}>Retry</button>
        </p>
      )}
      {!busy && !error && !orders.length && <p>No promotion purchases yet.</p>}
      {orders.map((order) => (
        <article className="promotion-order" key={order.reference}>
          <b>
            {order.productName} · {price(order.amount)} ·{" "}
            {order.environment.toUpperCase()}
          </b>
          <p>{statusText(order.status)}</p>
          <small>{order.reference}</small>
          <p>{new Date(order.createdAt).toLocaleString("en-ZA")}</p>
          <a href={`/account/promotions?reference=${order.reference}`}>
            Verify or recheck payment
          </a>
          <p><a href={`/listing/${encodeURIComponent(order.listingId)}/advert`}>Return to this listing</a></p>
          {order.reviewRequired && (
            <p>
              Support review is needed. Quote this reference for a refund or
              dispute query.
            </p>
          )}
        </article>
      ))}
      {next && (
        <button disabled={busy} onClick={() => void load(next)}>
          More purchases
        </button>
      )}
    </div>
  );
}
function CallbackVerifier({
  setMessage,
  setError,
}: {
  setMessage: (s: string) => void;
  setError: (s: string) => void;
}) {
  const { user, loading } = useSession();
  const [busy, setBusy] = useState(false);
  const verify = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const reference = new URLSearchParams(window.location.search).get(
        "reference",
      );
      if (!reference)
        throw Error(
          "No payment reference was supplied. Open promotion history to check your payment.",
        );
      setMessage("Verifying payment with Paystack…");
      const result = await promotionRequest(user, {
        action: "verify",
        reference,
      });
      setMessage(
        `${result.environment === "test" ? "TEST: " : ""}${statusText(result.status)}`,
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Verification unavailable.",
      );
      setMessage(
        "No payment success has been confirmed here. You can retry verification.",
      );
    } finally {
      setBusy(false);
    }
  }, [user, setError, setMessage]);
  useEffect(() => {
    if (user) void verify();
  }, [user, verify]);
  return user ? (
    <button className="button" disabled={busy} onClick={() => void verify()}>
      {busy ? "Checking…" : "Verify payment"}
    </button>
  ) : !loading ? (
    <a className="button" href="/auth">
      Sign in
    </a>
  ) : (
    <p>Loading account…</p>
  );
}
