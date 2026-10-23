import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import {
  ArrowRight,
  ArrowUpRight,
  Globe2,
  MessageCircle,
  ShieldAlert,
  CalendarDays,
} from "lucide-react";
import { adminDb, getPublicListings } from "@/lib/server";
import { categoryHref } from "@/lib/taxonomy";
import { brand } from "@/lib/config";
import {
  Article,
  Thread,
  StolenReport,
  Event,
  forumCategories,
} from "@/lib/community-models";
import { Card } from "@/components/card";
import { Empty } from "@/components/empty";
import { ArticleCard } from "@/components/news";
import { StolenCard } from "@/components/stolen";
import { SectionHeading } from "@/components/ui/primitives";
import { dataError } from "@/lib/errors";
export const dynamic = "force-dynamic";
const shortcuts = [
  { title: "Motocross", categoryId: "motorcycles/motocross" },
  { title: "Enduro", categoryId: "motorcycles/enduro" },
  { title: "Trials", categoryId: "motorcycles/trials" },
  { title: "Trail bikes", categoryId: "motorcycles/trail" },
  { title: "Pit bikes", categoryId: "motorcycles/pit-bikes" },
  { title: "Kids bikes", categoryId: "motorcycles/kids-bikes" },
  { title: "Parts", categoryId: "parts" },
  { title: "Riding gear", categoryId: "riding-gear" },
  { title: "Electronics", categoryId: "electronics" },
  { title: "Equipment", categoryId: "accessories" },
  { title: "Workshop", categoryId: "tools" },
];
export default async function Home() {
  const [listings, threads, articles, reports, events] =
    await Promise.allSettled([
      getPublicListings(undefined, 18),
      recent("forumThreads", "lastReplyAt", 8),
      recent("newsArticles", "publishedAt", 4),
      recent("stolenReports", "createdAt", 2),
      upcoming(),
    ]);
  return (
    <div className="home-hub">
      <section className="home-intro">
        <div className="wrap">
          <div className="intro-top">
            <div>
              <h1>{brand.homeHeading}</h1>
              <p>{brand.homeDescription}</p>
            </div>
          </div>

          <div className="intro-links">
            <span>
              <Globe2 size={14} />
              Off-road finds, across South Africa.
            </span>
            <Link href="/sell">
              Have something to sell?{" "}
              <b>
                List it here <ArrowUpRight size={14} />
              </b>
            </Link>
          </div>
        </div>
      </section>
      <section className="wrap section home-featured">
        <SectionHeading
          eyebrow="In the spotlight"
          title="Featured listings"
          description="A selection from the latest bikes, parts and gear in our marketplace."
          href="/browse"
          label="Explore marketplace"
        />
        {listings.status === "rejected" ? (
          <LoadError error={listings.reason} />
        ) : listings.value.length ? (
          <div
            className="home-listing-rail"
            tabIndex={0}
            role="region"
            aria-label="Featured listings, scroll for more"
          >
            {listings.value.slice(0, 6).map((listing) => (
              <Card key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <Empty
            title="Your next ride starts here."
            description="Published bikes, parts and riding gear will appear here. Be the first to share what is in your garage."
            href="/sell"
            label="List an item"
          />
        )}
      </section>
      <section className="wrap section">
        <SectionHeading
          eyebrow="Fresh from the garage"
          title="Latest listings"
          description="Bikes, parts and riding gear, ready for their next chapter."
          href="/browse"
          label="Browse all listings"
        />
        {listings.status === "rejected" ? (
          <LoadError error={listings.reason} />
        ) : listings.value.length ? (
          <div
            className="home-listing-rail"
            tabIndex={0}
            role="region"
            aria-label="Latest listings, scroll for more"
          >
            {listings.value.slice(0, 12).map((l) => (
              <Card key={l.id} listing={l} />
            ))}
          </div>
        ) : (
          <Empty
            title="Make the first move."
            description="No published listings just yet. Your bike, spare parts or riding kit could be someone’s next great find."
            href="/sell"
            label="Create a listing"
          />
        )}
      </section>
      <section className="wrap section">
        <SectionHeading
          eyebrow="What’s new"
          title="News & articles"
          href="/news"
          label="All news"
        />
        {articles.status === "rejected" ? (
          <LoadError error={articles.reason} />
        ) : articles.value.length ? (
          <div className="article-grid">
            {articles.value.map((a) => (
              <ArticleCard key={a.id} article={a as Article} />
            ))}
          </div>
        ) : (
          <Empty
            title="Good stories take a little time."
            description="Original motorcycle news, thoughtful reviews and workshop knowledge will appear here when our editorial team publishes."
          />
        )}
      </section>
      <section className="community-band">
        <div className="wrap community-pair">
          <div className="community-intro">
            <div className="eyebrow">
              <MessageCircle size={16} />
              In good company
            </div>
            <h2>Discussions</h2>
            <p>
              Workshop questions. Weekend rides. That restoration you can’t stop
              thinking about. There’s room for all of it here.
            </p>
            <Link className="button-secondary" href="/forum">
              Active topics <ArrowUpRight size={17} />
            </Link>
            <Link className="text-button home-start-topic" href="/forum/new">
              Start a discussion <ArrowRight size={16} />
            </Link>
          </div>
          <div className="home-topics">
            {threads.status === "rejected" ? (
              <LoadError error={threads.reason} />
            ) : threads.value.length ? (
              threads.value.map((item) => {
                const t = item as Thread;
                return (
                  <article className="topic-row" key={t.id}>
                    <span className="home-topic-avatar" aria-hidden="true">
                      {t.authorName.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <Link href={`/forum/${t.id}`}>
                        <h3>{t.title}</h3>
                      </Link>
                      <span className="home-topic-category">
                        {forumCategories[
                          t.category as keyof typeof forumCategories
                        ]?.[0] || t.category}
                      </span>
                    </div>
                    <small>
                      {t.authorName} · Last activity{" "}
                      {new Date(t.lastReplyAt).toLocaleDateString("en-ZA")}
                    </small>
                  </article>
                );
              })
            ) : (
              <Empty
                title="Every good discussion starts somewhere."
                description="Ask a question, introduce yourself or share what’s happening in your garage."
                href="/forum/new"
                label="Start a discussion"
              />
            )}
          </div>
        </div>
      </section>
      <section className="wrap section">
        <SectionHeading
          eyebrow="Get out there"
          title="On the riding calendar"
          href="/events"
          label="Explore events"
        />
        {events.status === "rejected" ? (
          <LoadError error={events.reason} />
        ) : events.value.length ? (
          <div className="home-events">
            {events.value.map((item) => {
              const e = item as Event;
              return (
                <article className="event-card" key={e.id}>
                  <div className="event-date">
                    <CalendarDays size={22} />
                    <time>
                      {new Date(e.startsAt).toLocaleDateString("en-ZA", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </time>
                  </div>
                  <span className="eyebrow">{e.type}</span>
                  <h3>
                    <Link href={`/events/${e.id}`}>{e.title}</Link>
                  </h3>
                  <p>
                    {e.city}, {e.country}
                  </p>
                  <Link href={`/events/${e.id}`} className="text-button">
                    Event details <ArrowUpRight size={15} />
                  </Link>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="calendar-empty">
            <CalendarDays size={26} />
            <div>
              <h3>Nothing on the calendar just yet.</h3>
              <p>
                Confirmed race meetings, training days and community rides will
                appear here.
              </p>
            </div>
            <Link href="/events">
              View calendar <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </section>
      <section className="wrap home-category-section">
        <SectionHeading
          title="Find your kind of riding"
          href="/browse"
          label="All categories"
        />
      </section>
      <section
        className="wrap category-shortcuts"
        aria-label="Browse by category"
      >
        {shortcuts.map(({ title, categoryId }) => (
          <Link href={categoryHref(categoryId)} key={title}>
            <span>
              <CategoryIcon category={categoryId} size={72} />
            </span>
            <b>{title}</b>
            <ArrowUpRight className="category-arrow" size={14} />
          </Link>
        ))}
      </section>
      <section className="wrap awareness">
        <div className="awareness-icon">
          <ShieldAlert size={25} />
        </div>
        <div>
          <div className="eyebrow">Look out for each other</div>
          <h2>Help a bike find its way home.</h2>
          <p>
            Browse reviewed, user-submitted reports or report a stolen
            motorcycle. Personal evidence stays private.
          </p>
        </div>
        <div>
          <Link href="/stolen-bikes" className="button-secondary">
            View stolen-bike reports <ArrowUpRight size={16} />
          </Link>
          <Link href="/stolen-bikes/report">
            Submit a report <ArrowRight size={15} />
          </Link>
        </div>
      </section>
      {reports.status === "fulfilled" && reports.value.length > 0 && (
        <section className="wrap section">
          <div className="article-grid">
            {reports.value.map((r) => (
              <StolenCard key={r.id} report={r as StolenReport} />
            ))}
          </div>
        </section>
      )}
      <section className="seller-invitation">
        <div className="wrap">
          <div>
            <div className="eyebrow">From one rider to the next</div>
            <h2>A new chapter starts in your garage.</h2>
            <p>
              Make room for the next adventure. List your bike, parts or riding
              gear.
            </p>
          </div>
          <Link className="button" href="/sell">
            Sell an item <ArrowUpRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
async function recent(name: string, order: string, count: number) {
  let q = adminDb().collection(name).where("status", "==", "published");
  if (name === "stolenReports") q = q.where("country", "==", "ZA");
  const s = await q.orderBy(order, "desc").limit(count).get();
  return s.docs.map((d) => ({ ...d.data(), id: d.id }));
}
async function upcoming() {
  const s = await adminDb()
    .collection("events")
    .where("country", "==", "ZA")
    .where("status", "==", "published")
    .where("endsAt", ">=", Date.now())
    .orderBy("endsAt", "asc")
    .limit(8)
    .get();
  return s.docs
    .map((d) => ({ ...d.data(), id: d.id }))
    .sort((a, b) => (a as Event).startsAt - (b as Event).startsAt);
}
function LoadError({ error }: { error: unknown }) {
  return (
    <div className="notice error" role="alert">
      <b>We couldn’t load this content.</b> {dataError(error)}
    </div>
  );
}
