"use client";
import { useState } from "react";
import { useSession } from "@/components/session";
import { useRole } from "@/components/use-role";
export default function Page() {
  const { admin, checking } = useRole();
  const { user } = useSession(),
    [orders, setOrders] = useState<
      Array<{
        reference: string;
        listingId: string;
        status: string;
        reviewReason?: string;
        amount: number;
      }>
    >([]),
    [error, setError] = useState(""),
    [next, setNext] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  async function request(body?: unknown, more = false) {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const result = await fetch(
        `/api/admin/payments${more && next ? `?after=${next}` : ""}`,
        {
          method: body ? "POST" : "GET",
          headers: {
            Authorization: `Bearer ${await user.getIdToken()}`,
            "Content-Type": "application/json",
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
          cache: "no-store",
        },
      );
      const json = await result.json();
      if (!result.ok) throw Error(json.error);
      if (body) {
        setOrders([]);
        setNext(null);
      } else {
        setOrders((old) => (more ? [...old, ...json.orders] : json.orders));
        setNext(json.next);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Review unavailable.");
    } finally {
      setBusy(false);
    }
  }
  if (checking)
    return (
      <section className="wrap section" role="status">
        Checking access…
      </section>
    );
  if (!admin)
    return (
      <section className="wrap section">
        <h1>Administrator access required</h1>
      </section>
    );
  return (
    <section className="wrap section">
      <h1>Payment review</h1>
      <p>
        Administrator access is checked by the server. Refunds must be initiated
        through Paystack; this screen never sends money or invents a refund
        confirmation.
      </p>
      <button disabled={!user || busy} onClick={() => void request()}>
        Load review queue
      </button>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {orders.map((order) => (
        <article className="promotion-order" key={order.reference}>
          <h2>{order.reference}</h2>
          <p>
            {order.listingId} · {order.status} · R
            {(order.amount / 100).toFixed(2)} · {order.reviewReason}
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void request({ action: "verify", reference: order.reference })
            }
          >
            Recheck with Paystack
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void request({
                reference: order.reference,
                action: data.get("action"),
                note: data.get("note"),
              });
            }}
          >
            <label>
              Review note
              <input name="note" required minLength={5} maxLength={1000} />
            </label>
            <select name="action">
              <option value="note">Add note</option>
              <option value="refund_required">Flag refund required</option>
              <option value="close">Close resolved review</option>
            </select>
            <button disabled={busy}>Save review</button>
          </form>
        </article>
      ))}
      {next && (
        <button disabled={busy} onClick={() => void request(undefined, true)}>
          More reviews
        </button>
      )}
    </section>
  );
}
