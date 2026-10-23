"use client";
import { LoadingState } from "@/components/ui/primitives";
import Link from "next/link";
import { useState } from "react";
import { Event, eventTypes } from "@/lib/community-models";
import { usePageQuery } from "./use-page-query";
import { Empty } from "./empty";
import { brand } from "@/lib/config";
export function Events() {
  const [type, setType] = useState(""),
    [past, setPast] = useState(false),
    [cutoff] = useState(() => String(Date.now()));
  const feed = usePageQuery<Event>(
    "events",
    { type, ...(past ? { _endsBefore: cutoff } : { _endsAfter: cutoff }) },
    "endsAt",
    past ? "desc" : "asc",
  );
  const items = feed.items;
  return (
    <section className="wrap section">
      <div className="eyebrow">RIDING TOGETHER</div>
      <h1>A date with the dirt.</h1>
      <p>
        Race meetings, training and community rides published by the{" "}
        {brand.name}
        team.
      </p>
      <div className="inline-search">
        <select
          aria-label="Event type"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">All event types</option>
          {eventTypes.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <button onClick={() => setPast(!past)}>
          {past ? "Show upcoming events" : "Show past events"}
        </button>
      </div>
      {feed.error && <p className="notice error">{feed.error}</p>}
      {feed.busy && <LoadingState label="Loading events…" />}
      <div className="article-grid">
        {items.map((e) => (
          <article className="event-card" key={e.id}>
            <time>{new Date(e.startsAt).toLocaleString("en-ZA")}</time>
            <h2>
              <Link href={`/events/${e.id}`}>{e.title}</Link>
            </h2>
            <p>
              {e.city}, {e.country} · {e.type}
            </p>
            <small>{e.organizer}</small>
          </article>
        ))}
      </div>
      {!feed.busy && !feed.error && !items.length && (
        <Empty
          title={
            past
              ? "No past events in this page."
              : "No upcoming events in this page."
          }
          description={
            feed.more
              ? "Load the next page to continue through the calendar."
              : "Published events will appear here once organizers confirm the details."
          }
        />
      )}
      {feed.more && (
        <button onClick={feed.loadMore} disabled={feed.busy}>
          Load next calendar page
        </button>
      )}
      <Link className="text-button" href="/admin/events">
        Events workspace →
      </Link>
    </section>
  );
}
