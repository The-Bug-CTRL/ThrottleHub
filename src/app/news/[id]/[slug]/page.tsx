import { notFound } from "next/navigation";
import { adminDb, publicDocument } from "@/lib/server";
import { Article } from "@/lib/community-models";
import { ContentText } from "@/components/content-text";
import { ArticleCard, ShareContent } from "@/components/news";
import Link from "next/link";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const a = (await publicDocument(
    "newsArticles",
    (await params).id,
  )) as Article | null;
  return {
    title: a?.title || "Article unavailable",
    description: a?.summary,
    alternates: { canonical: a ? `/news/${a.id}/${a.slug}` : undefined },
    openGraph: {
      title: a?.title,
      description: a?.summary,
      images: a?.coverImage ? [a.coverImage] : [],
    },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const a = (await publicDocument(
    "newsArticles",
    (await params).id,
  )) as Article | null;
  if (!a) notFound();
  const related = await adminDb()
    .collection("newsArticles")
    .where("status", "==", "published")
    .where("category", "==", a.category)
    .orderBy("publishedAt", "desc")
    .limit(4)
    .get();
  return (
    <>
      <article className="reading-panel article-reading">
        <Link href="/news">← News & articles</Link>
        <div className="eyebrow">{a.category}</div>
        <h1>{a.title}</h1>
        <p className="article-summary">{a.summary}</p>
        <div className="byline">
          {a.authorName}
          <time>{new Date(a.publishedAt).toLocaleDateString("en-ZA")}</time>
        </div>
        {a.coverImage && (
          <figure>
            <img src={a.coverImage} alt={a.caption || a.title} />
            {a.caption && <figcaption>{a.caption}</figcaption>}
          </figure>
        )}
        <ContentText text={a.body} />
        <ShareContent />
      </article>
      <section className="wrap section">
        <h2>More from the editorial desk.</h2>
        <div className="article-grid">
          {related.docs
            .filter((d) => d.id !== a.id)
            .map((d) => (
              <ArticleCard
                key={d.id}
                article={{ ...d.data(), id: d.id } as Article}
              />
            ))}
        </div>
      </section>
    </>
  );
}
