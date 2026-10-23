"use client";
import { LoadingState } from "@/components/ui/primitives";
import { provinces, provinceCode } from "@/lib/marketplace";
import { confirmAction } from "@/components/ui/dialogs";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Article,
  articleSchema,
  newsCategories,
  Event,
  eventSchema,
  eventTypes,
} from "@/lib/community-models";
import { slugify, tokens } from "@/lib/models";
import { dataError } from "@/lib/errors";
import { brand } from "@/lib/config";
import { useRole } from "./use-role";
import { ImageUpload } from "./image-upload";
import { AdminNavigation } from "./admin-navigation";
type Entry = Article | Event;
export function Editorial({ events = false }: { events?: boolean }) {
  const { admin, checking, user } = useRole();
  const name = events ? "events" : "newsArticles";
  const [entries, setEntries] = useState<Entry[]>([]),
    [id, setId] = useState(""),
    [entry, setEntry] = useState<Partial<Entry>>({}),
    [cover, setCover] = useState<string[]>([]),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      const s = await getDocs(
        query(collection(db, name), orderBy("updatedAt", "desc"), limit(30)),
      );
      setEntries(s.docs.map((d) => ({ ...d.data(), id: d.id }) as Entry));
    } catch (e) {
      setNotice(dataError(e));
    }
  }
  useEffect(() => {
    if (admin) {
      void load();
      setId(doc(collection(db, name)).id);
    }
  }, [admin, name]);
  if (checking)
    return (
      <section className="wrap section">
        <LoadingState label="Checking editorial access…" />
      </section>
    );
  if (!admin || !user)
    return (
      <div className="auth-panel">
        <h1>Editorial access required.</h1>
        <p>
          Only accounts with a server-issued administrator claim can publish
          official content.
        </p>
        <Link href="/auth">Sign in</Link>
      </div>
    );
  async function save(form: HTMLFormElement, status: "draft" | "published") {
    setBusy(true);
    try {
      const fields = Object.fromEntries(new FormData(form));
      const now = Date.now();
      const d = events
        ? eventSchema.parse({
            ...fields,
            startsAt: Date.parse(String(fields.startsAt)),
            endsAt: Date.parse(String(fields.endsAt)),
          })
        : articleSchema.parse({ ...fields, coverImage: cover[0] || "" });
      const existing = await getDoc(doc(db, name, id));
      await setDoc(doc(db, name, id), {
        ...d,
        ownerId: existing.data()?.ownerId || user!.uid,
        status,
        createdAt: existing.data()?.createdAt || now,
        updatedAt: now,
        ...(!events
          ? {
              slug: slugify(d.title),
              publishedAt:
                status === "published"
                  ? existing.data()?.publishedAt || now
                  : 0,
              searchTokens: tokens(`${d.title} ${d.body}`),
            }
          : {}),
      });
      setNotice(status === "published" ? "Published." : "Draft saved.");
      await load();
    } catch (e) {
      setNotice(dataError(e));
    } finally {
      setBusy(false);
    }
  }
  const article = entry as Partial<Article>,
    event = entry as Partial<Event>;
  return (
    <section className="wrap section">
      <div className="eyebrow">ADMINISTRATION</div>
      <h1>{events ? "Events workspace." : "Editorial workspace."}</h1>
      <AdminNavigation />
      <div className="community-layout">
        <aside className="category-nav">
          <button
            onClick={() => {
              setId(doc(collection(db, name)).id);
              setEntry({});
              setCover([]);
            }}
          >
            + Create {events ? "event" : "article"}
          </button>
          {entries.map((e) => (
            <button
              className={e.id === id ? "active" : ""}
              key={e.id}
              onClick={() => {
                setId(e.id);
                setEntry(e);
                setCover(
                  !events && (e as Article).coverImage
                    ? [(e as Article).coverImage]
                    : [],
                );
              }}
            >
              <b>{e.title}</b>
              <small>{e.status}</small>
            </button>
          ))}
          <small>
            Latest 30 records. Use IDs for older records through future
            editorial pagination.
          </small>
        </aside>
        <form
          key={id}
          onSubmit={(e) => {
            e.preventDefault();
            void save(e.currentTarget, "published");
          }}
        >
          <label>
            Title
            <input
              name="title"
              required
              minLength={8}
              maxLength={events ? 140 : 160}
              defaultValue={entry.title}
            />
          </label>
          {events ? (
            <>
              <label>
                Event type
                <select name="type" defaultValue={event.type}>
                  {eventTypes.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <div className="field-row">
                <label>
                  Starts (your local time)
                  <input
                    name="startsAt"
                    type="datetime-local"
                    required
                    defaultValue={
                      event.startsAt ? localDateTime(event.startsAt) : ""
                    }
                  />
                </label>
                <label>
                  Ends (your local time)
                  <input
                    name="endsAt"
                    type="datetime-local"
                    required
                    defaultValue={
                      event.endsAt ? localDateTime(event.endsAt) : ""
                    }
                  />
                </label>
              </div>
              <div className="field-row">
                <label>
                  Country
                  <select name="country" defaultValue={event.country || "ZA"}>
                    {Object.entries(brand.countries)
                      .filter(([c]) => c !== "global")
                      .map(([c, n]) => (
                        <option key={c} value={c}>
                          {n}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Province
                  <select
                    name="region"
                    required
                    defaultValue={provinceCode(event.region || "")}
                  >
                    <option value="">Choose province</option>
                    {Object.entries(provinces).map(([code, name]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  City
                  <input name="city" required defaultValue={event.city} />
                </label>
              </div>
              <label>
                Public venue
                <input
                  name="venue"
                  maxLength={160}
                  defaultValue={event.venue}
                />
              </label>
              <label>
                Organizer
                <input
                  name="organizer"
                  required
                  maxLength={120}
                  defaultValue={event.organizer}
                />
              </label>
              <label>
                Organizer information link (https)
                <input name="link" type="url" defaultValue={event.link} />
              </label>
            </>
          ) : (
            <>
              <label>
                Category
                <select name="category" defaultValue={article.category}>
                  {newsCategories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Author byline
                <input
                  name="authorName"
                  required
                  minLength={2}
                  maxLength={80}
                  defaultValue={article.authorName || user.displayName || ""}
                />
              </label>
              <label>
                Summary
                <textarea
                  name="summary"
                  required
                  minLength={20}
                  maxLength={350}
                  defaultValue={article.summary}
                />
              </label>
              <ImageUpload
                path={`news-images/${id}`}
                images={cover}
                max={1}
                onChange={setCover}
              />
              <label>
                Cover caption / credit
                <input
                  name="caption"
                  maxLength={300}
                  defaultValue={article.caption}
                />
              </label>
            </>
          )}
          <label>
            {events
              ? "Event details"
              : "Article body — paragraphs and https links"}
            <textarea
              name="body"
              rows={16}
              required
              minLength={events ? 20 : 40}
              maxLength={events ? 8000 : 50000}
              defaultValue={entry.body}
            />
          </label>
          {busy && <LoadingState size={64} label="Saving content…" />}
          <div className="form-actions">
            <button
              type="button"
              disabled={busy}
              onClick={(e) => {
                const form = e.currentTarget.closest("form");
                if (form) void save(form, "draft");
              }}
            >
              Save draft / unpublish
            </button>
            <button className="button" disabled={busy}>
              Publish {events ? "event" : "article"}
            </button>
            {entry.id && (
              <button
                type="button"
                onClick={async () => {
                  if (
                    !(await confirmAction(
                      "Permanently delete this editorial record?",
                    ))
                  )
                    return;
                  try {
                    await deleteDoc(doc(db, name, id));
                    setEntry({});
                    setId(doc(collection(db, name)).id);
                    setCover([]);
                    await load();
                    setNotice("Record deleted.");
                  } catch (e) {
                    setNotice(dataError(e));
                  }
                }}
              >
                Delete
              </button>
            )}
          </div>
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
function localDateTime(ms: number) {
  const d = new Date(ms);
  return new Date(ms - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
