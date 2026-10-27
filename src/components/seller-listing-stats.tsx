"use client";
import { useState } from "react";
import type { User } from "firebase/auth";
import { Eye, Phone, MessageCircle, Heart, BarChart3 } from "lucide-react";
type Stats = {
  views: number;
  phoneReveals: number;
  messageClicks: number;
  favourites: number;
};
export function SellerListingStats({ id, user }: { id: string; user: User }) {
  const [stats, setStats] = useState<Stats | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [open, setOpen] = useState(false);
  async function load() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/listings/${encodeURIComponent(id)}/stats`,
        {
          headers: { Authorization: "Bearer " + (await user.getIdToken()) },
          cache: "no-store",
        },
      );
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Stats unavailable.");
      setStats(result);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Stats unavailable.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="seller-listing-stats">
      <button
        type="button"
        className="text-button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open) void load();
        }}
      >
        <BarChart3 size={16} />
        {open ? "Hide ad stats" : "Ad stats"}
      </button>
      {open && (
        <div>
          {busy && <p role="status">Loading stats�</p>}
          {error && (
            <p className="notice error" role="alert">
              {error}{" "}
              <button type="button" onClick={load}>
                Retry
              </button>
            </p>
          )}
          {stats && (
            <>
              <dl className="ad-stat-grid">
                {[
                  [Eye, "Views", stats.views],
                  [Phone, "Phone reveals", stats.phoneReveals],
                  [MessageCircle, "Message clicks", stats.messageClicks],
                  [Heart, "Favourites", stats.favourites],
                ].map(([Icon, label, value]) => {
                  const I = Icon as typeof Eye;
                  return (
                    <div key={String(label)}>
                      <dt>
                        <I size={16} />
                        {String(label)}
                      </dt>
                      <dd>{Number(value).toLocaleString("en-ZA")}</dd>
                    </div>
                  );
                })}
              </dl>
              <small>
                Views and contact clicks count once per visitor each day; your
                own visits are excluded. Favourites shows current saves. Clicks
                do not confirm a call or message. Tracking starts when enabled.
              </small>
              <button
                type="button"
                className="text-button"
                onClick={load}
                disabled={busy}
              >
                Refresh stats
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
