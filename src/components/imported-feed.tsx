"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { LoadingState } from "./ui/primitives";
import { Empty } from "./empty";
import {
  displayCalendarDate,
  type ImportedNews,
  type ImportedRace,
} from "@/lib/imported-content";

export function useImportedFeed<T>(
  kind: "news" | "races" | "videos",
  filters: Record<string, string>,
) {
  const key = new URLSearchParams(filters).toString();
  const [items, setItems] = useState<T[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [categories, setCategories] = useState<string[]>([]);
  const generation = useRef({ value: 0 });
  const load = useCallback(
    async (after?: string) => {
      const current = ++generation.current.value;
      setBusy(true);
      setError("");
      if (!after) {
        setItems([]);
        setCursor(null);
      }
      try {
        const response = await fetch(
          `/api/content/${kind}?${key}${after ? `&cursor=${encodeURIComponent(after)}` : ""}`,
          { cache: "no-store" },
        );
        const result = await response.json();
        if (!response.ok) throw Error(result.error || "Feed unavailable");
        if (current !== generation.current.value) return;
        setItems((old) =>
          after
            ? [
                ...old,
                ...result.items.filter(
                  (x: { id: string }) =>
                    !old.some((y) => (y as { id: string }).id === x.id),
                ),
              ]
            : result.items,
        );
        setCursor(result.cursor);
        setCategories((old) =>
          [...new Set([...old, ...result.categories] as string[])].sort(),
        );
      } catch (e) {
        if (current === generation.current.value)
          setError(e instanceof Error ? e.message : "Feed unavailable");
      } finally {
        if (current === generation.current.value) setBusy(false);
      }
    },
    [kind, key],
  );
  useEffect(() => {
    const state = generation.current;
    void load();
    return () => {
      state.value++;
    };
  }, [load]);
  return { items, categories, cursor, busy, error, load };
}
export function FeedState({
  feed,
  label,
}: {
  feed: {
    busy: boolean;
    error: string;
    items: unknown[];
    cursor: string | null;
    load: (cursor?: string) => Promise<void>;
  };
  label: string;
}) {
  return (
    <>
      {feed.busy && <LoadingState label={`Loading ${label}…`} />}
      {feed.error && (
        <div role="alert" className="notice error">
          {feed.error}{" "}
          <button onClick={() => void feed.load(feed.cursor || undefined)}>
            Retry
          </button>
        </div>
      )}
      {!feed.busy && !feed.error && !feed.items.length && (
        <Empty
          title={`No ${label} in this view.`}
          description={
            feed.cursor
              ? "Continue to the next page to check more matching content."
              : "Try different filters or check back later."
          }
        />
      )}
      {feed.cursor && (
        <button
          disabled={feed.busy}
          onClick={() => void feed.load(feed.cursor!)}
        >
          Load more {label}
        </button>
      )}
    </>
  );
}
export function ImportedArticleCard({ article: a }: { article: ImportedNews }) {
  const [failed, setFailed] = useState(false);
  return (
    <article className="article-card has-cover">
      <a href={a.url} target="_blank" rel="noopener noreferrer">
        {a.imageUrl && !failed ? (
          <img
            src={a.imageUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="news-brand-fallback" aria-label="ThrottleHub news">
            <strong>ThrottleHub</strong>
            <span>FROM THE WORLD OF DIRT</span>
          </div>
        )}
      </a>
      <div>
        <span className="eyebrow">{a.category || "News"}</span>
        <a href={a.url} target="_blank" rel="noopener noreferrer">
          <h2>{a.title}</h2>
        </a>
        <p>{a.summary}</p>
        <small>
          {a.publisher} ·{" "}
          {new Date(a.publishedAt).toLocaleDateString("en-ZA", {
            timeZone: "Africa/Johannesburg",
          })}
        </small>
        <p>
          <a
            className="text-button"
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Read at {a.publisher || "the publisher"} ↗
          </a>
        </p>
      </div>
    </article>
  );
}
export function ImportedRaceCard({ event: e }: { event: ImportedRace }) {
  return (
    <article className="event-card">
      <time dateTime={e.startDate}>
        {displayCalendarDate(e.startDate)}
        {e.endDate !== e.startDate
          ? ` – ${displayCalendarDate(e.endDate)}`
          : ""}
      </time>
      <span className="eyebrow">
        {[e.discipline, e.level].filter(Boolean).join(" · ")}
      </span>
      <h2>{e.title}</h2>
      <p>
        {[e.venue, e.city, e.province, e.country].filter(Boolean).join(", ") ||
          "Location to be confirmed"}
      </p>
      {(e.championship || e.organiser) && (
        <p>{[e.championship, e.organiser].filter(Boolean).join(" · ")}</p>
      )}
      {(e.status || e.dateStatus) && (
        <p>{[e.status, e.dateStatus].filter(Boolean).join(" · ")}</p>
      )}
      <div className="form-actions">
        {e.sourceUrl && (
          <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer">
            Official source ↗
          </a>
        )}
        {e.registrationUrl && (
          <a href={e.registrationUrl} target="_blank" rel="noopener noreferrer">
            Registration ↗
          </a>
        )}
      </div>
    </article>
  );
}

/** Homepage summary only; the full calendar card remains unchanged. */
export function CompactRaceCard({ event: e }: { event: ImportedRace }) {
  const link = e.sourceUrl || e.registrationUrl;
  const exception = [e.status, e.dateStatus]
    .filter(
      (value) =>
        value && !["scheduled", "confirmed"].includes(value.toLowerCase()),
    )
    .join(" · ");
  return (
    <article className="compact-race-card">
      <time dateTime={e.startDate}>
        {displayCalendarDate(e.startDate)}
        {e.endDate !== e.startDate
          ? ` – ${displayCalendarDate(e.endDate)}`
          : ""}
      </time>
      <h3 title={e.title}>
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer">
            {e.title}
          </a>
        ) : (
          e.title
        )}
      </h3>
      <small>{[e.discipline, e.level].filter(Boolean).join(" · ")}</small>
      {(e.venue || e.province) && (
        <p>{[e.venue, e.province].filter(Boolean).join(" · ")}</p>
      )}
      {exception && <small className="compact-race-status">{exception}</small>}
      {link && (
        <a
          className="compact-race-source"
          href={link}
          target="_blank"
          rel="noopener noreferrer"
        >
          Official event ↗
        </a>
      )}
    </article>
  );
}
