"use client";
import {
  useImportedFeed,
  ImportedArticleCard,
  FeedState,
} from "./imported-feed";
import type { ImportedNews } from "@/lib/imported-content";
import Link from "next/link";
import { useState } from "react";
import { Article } from "@/lib/community-models";

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
  const feed = useImportedFeed<ImportedNews>("news", {
    category,
    search: keyword,
  });
  return (
    <section className="wrap section">
      <div className="eyebrow">NEWS & ARTICLES</div>
      <h1>From the world of dirt.</h1>
      <p>Motorcycle news from the original publishers.</p>
      <form
        className="inline-search"
        onSubmit={(e) => {
          e.preventDefault();
          setKeyword(search.trim());
        }}
      >
        <input
          aria-label="Search articles"
          placeholder="Search news"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          maxLength={120}
        />
        <label>
          Category
          <input
            aria-label="Article category"
            list="imported-news-categories"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="All categories"
            maxLength={100}
          />
        </label>
        <datalist id="imported-news-categories">
          {feed.categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <button className="button">Search</button>
        {category && (
          <button type="button" onClick={() => setCategory("")}>
            All categories
          </button>
        )}
      </form>
      <div className="article-grid">
        {feed.items.map((a) => (
          <ImportedArticleCard key={a.id} article={a} />
        ))}
      </div>
      <FeedState feed={feed} label="articles" />
      <Link className="text-button" href="/admin/editorial">
        News workspace →
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
