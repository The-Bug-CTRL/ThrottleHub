import { notFound } from "next/navigation";
import Link from "next/link";
import { publicDocument } from "@/lib/server";
import { Event } from "@/lib/community-models";
import { ContentText } from "@/components/content-text";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const e = (await publicDocument("events", (await params).id)) as Event | null;
  if (!e) notFound();
  return (
    <article className="reading-panel">
      <Link href="/events">← Events</Link>
      <div className="eyebrow">
        {e.type} {e.endsAt < Date.now() ? "· PAST EVENT" : ""}
      </div>
      <h1>{e.title}</h1>
      <p>
        {new Date(e.startsAt).toLocaleString("en-ZA")} –{" "}
        {new Date(e.endsAt).toLocaleString("en-ZA")}
      </p>
      <p>
        {e.venue} · {e.city}, {e.region}, {e.country}
      </p>
      <p>
        Organized by {e.organizer}. Dates display in your browsing environment’s
        timezone; confirm start time with the organizer.
      </p>
      <ContentText text={e.body} />
      {e.link && (
        <a
          className="button"
          href={e.link}
          target="_blank"
          rel="noopener noreferrer"
        >
          Organizer information ↗
        </a>
      )}
    </article>
  );
}
