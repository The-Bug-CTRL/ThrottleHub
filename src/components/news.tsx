"use client";
import { LoadingState } from "@/components/ui/primitives";
import Link from "next/link";
import { useState } from "react";
import { Article, newsCategories } from "@/lib/community-models";
import { usePageQuery } from "./use-page-query";
import { Empty } from "./empty";
import { brand } from "@/lib/config";
export function ArticleCard({
  article: a,
  featured = false,
}: {
  article: Article;
  featured?: boolean;
}) {
  return (
    <article
      className={`article-card ${featured ? "featured" : ""} ${a.coverImage ? "has-cover" : ""}`}
    >
      {a.coverImage && (
        <Link href={`/news/${a.id}/${a.slug}`}>
          <img src={a.coverImage} alt={a.caption || a.title} />
        </Link>
      )}
      <div>
        <span className="eyebrow">{a.category}</span>
        <Link href={`/news/${a.id}/${a.slug}`}>
          <h2>{a.title}</h2>
        </Link>
        <p>{a.summary}</p>
        <small>
          {a.authorName} · {new Date(a.publishedAt).toLocaleDateString("en-ZA")}
        </small>
      </div>
    </article>
  );
}
export function News() {
  const [category, setCategory] = useState(""),
    [search, setSearch] = useState(""),
    [keyword, setKeyword] = useState("");
  const feed = usePageQuery<Article>(
    "newsArticles",
    { category, searchTokens: keyword },
    "publishedAt",
  );
  return (
    <section className="wrap section">
      <div className="eyebrow">NEWS & ARTICLES</div>
      <h1>From the world of dirt.</h1>
      <p>
        Original stories, technical knowledge and motorcycle news from
        {brand.name}.
      </p>
      <form
        className="inline-search"
        onSubmit={(e) => {
          e.preventDefault();
          setKeyword(search.toLowerCase().trim());
        }}
      >
        <input
          aria-label="Search articles"
          placeholder="One keyword or prefix"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Article category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {newsCategories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button className="button">Search</button>
      </form>
      {feed.error && (
        <p className="notice error" role="alert">
          {feed.error}
        </p>
      )}
      {feed.busy && <LoadingState label="Loading articles…" />}
      <div className="article-grid">
        {feed.items.map((a, i) => (
          <ArticleCard key={a.id} article={a} featured={i === 0} />
        ))}
      </div>
      {!feed.error && !feed.busy && !feed.items.length && (
        <Empty
          title="The next story is still being written."
          description={`No articles have been published in this view. Genuine ${brand.name} news and technical features will appear here.`}
        />
      )}
      {feed.more && (
        <button onClick={feed.loadMore} disabled={feed.busy}>
          Load more articles
        </button>
      )}
      <Link className="text-button" href="/admin/editorial">
        Editorial workspace →
      </Link>
    </section>
  );
}
export function ShareContent() {
  const [message, setMessage] = useState("");
  return (
    <>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(location.href);
            setMessage("Link copied.");
          } catch {
            setMessage(location.href);
          }
        }}
      >
        Share link
      </button>
      {message && <small role="status"> {message}</small>}
    </>
  );
}
