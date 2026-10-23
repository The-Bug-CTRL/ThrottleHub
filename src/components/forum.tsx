"use client";
import { RoostLoader } from "@/components/loading/roost-loader";
import { LoadingState } from "@/components/ui/primitives";
import { confirmAction, requestText } from "@/components/ui/dialogs";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  getCountFromServer,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { dataError } from "@/lib/errors";
import {
  forumCategories,
  Thread,
  Reply,
  threadSchema,
} from "@/lib/community-models";
import {
  createThread,
  createReply,
  reportContent,
  moderateContent,
} from "@/lib/community";
import { tokens } from "@/lib/models";
import { useSession } from "./session";
import { usePageQuery } from "./use-page-query";
import { ContentText } from "./content-text";
import { Empty } from "./empty";
export function Forum() {
  const [category, setCategory] = useState(""),
    [term, setTerm] = useState(""),
    [keyword, setKeyword] = useState(""),
    [sort, setSort] = useState("lastReplyAt");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const feed = usePageQuery<Thread>(
    "forumThreads",
    { category, searchTokens: keyword },
    sort,
  );
  useEffect(() => {
    let active = true;
    Promise.all(
      Object.keys(forumCategories).map(
        async (c) =>
          [
            c,
            (
              await getCountFromServer(
                query(
                  collection(db, "forumThreads"),
                  where("status", "==", "published"),
                  where("category", "==", c),
                ),
              )
            ).data().count,
          ] as const,
      ),
    )
      .then((p) => {
        if (active) setCounts(Object.fromEntries(p));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="wrap section">
      <div className="section-heading">
        <div className="eyebrow">THE COMMUNITY</div>
        <h1>Talk bikes. Share the knowledge.</h1>
        <Link className="button" href="/forum/new">
          Create discussion
        </Link>
      </div>
      <div className="community-layout">
        <aside className="category-nav">
          <button
            className={!category ? "active" : ""}
            onClick={() => setCategory("")}
          >
            All discussions
          </button>
          {Object.entries(forumCategories).map(([id, [label, description]]) => (
            <button
              className={category === id ? "active" : ""}
              onClick={() => setCategory(id)}
              key={id}
            >
              <b>{label}</b>
              <small>{description}</small>
              {counts[id] !== undefined && <span>{counts[id]} topics</span>}
            </button>
          ))}
        </aside>
        <div>
          <form
            className="inline-search"
            onSubmit={(e) => {
              e.preventDefault();
              setKeyword(term.trim().toLowerCase());
            }}
          >
            <input
              aria-label="Search discussions"
              placeholder="One keyword or prefix"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
            <button className="button">Search</button>
            <select
              aria-label="Topic ordering"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="lastReplyAt">Recently active</option>
              <option value="createdAt">Latest discussions</option>
            </select>
          </form>
          <p className="muted">
            Text is displayed safely as paragraphs and https links. Posting is
            limited to once every 15 seconds.
          </p>
          {feed.error && (
            <p role="alert" className="notice error">
              {feed.error}
            </p>
          )}
          {feed.busy && <LoadingState label="Loading discussions…" />}
          {feed.items.map((t) => (
            <article className="topic-row" key={t.id}>
              <span className="eyebrow">
                {forumCategories[
                  t.category as keyof typeof forumCategories
                ]?.[0] || t.category}
                {t.locked ? " · LOCKED" : ""}
              </span>
              <Link href={`/forum/${t.id}`}>
                <h3>{t.title}</h3>
              </Link>
              <small>
                <Link href={`/seller/${t.ownerId}`}>{t.authorName}</Link> ·
                Started {new Date(t.createdAt).toLocaleDateString("en-ZA")} ·
                Last activity {new Date(t.lastReplyAt).toLocaleString("en-ZA")}
              </small>
            </article>
          ))}
          {!feed.busy && !feed.error && !feed.items.length && (
            <Empty
              title="The conversation starts with you."
              description="No discussions match this view. Ask a technical question, share a build or introduce yourself."
              href="/forum/new"
              label="Start a discussion"
            />
          )}
          {feed.more && (
            <button disabled={feed.busy} onClick={feed.loadMore}>
              Load more discussions
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
export function NewThread() {
  const { user, loading } = useSession();
  const router = useRouter();
  const [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  if (loading)
    return (
      <section className="wrap section">
        <LoadingState label="Loading account…" />
      </section>
    );
  if (!user)
    return (
      <div className="auth-panel">
        <h1>Join the conversation.</h1>
        <Link className="button" href="/auth">
          Sign in to start a discussion
        </Link>
      </div>
    );
  return (
    <section className="form-panel">
      <div className="eyebrow">COMMUNITY FORUM</div>
      <h1>Start a discussion.</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const d = Object.fromEntries(new FormData(e.currentTarget));
            const id = await createThread(user, d);
            router.push(`/forum/${id}`);
          } catch (error) {
            setNotice(dataError(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Category
          <select name="category">
            {Object.entries(forumCategories).map(([id, [label]]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Title
          <input name="title" required minLength={8} maxLength={140} />
        </label>
        <label>
          Your discussion
          <textarea
            name="body"
            rows={10}
            required
            minLength={20}
            maxLength={12000}
          />
        </label>
        <p className="muted">
          Share a YouTube or Vimeo link in your post to add a video.
        </p>
        <p className="muted">
          Respect other riders. Keep personal contact details private. No spam,
          harassment or unsupported accusations.
        </p>
        <button className="button" disabled={busy}>
          {busy && <RoostLoader size={40} label="Publishing discussion" />}{" "}
          Publish discussion
        </button>
        {notice && (
          <p role="alert" className="notice error">
            {notice}
          </p>
        )}
      </form>
    </section>
  );
}
export function ThreadPage({ thread: initial }: { thread: Thread }) {
  const [thread, setThread] = useState(initial);
  const { user } = useSession();
  const [canModerate, setCanModerate] = useState(false),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [body, setBody] = useState("");
  const replies = usePageQuery<Reply>(
    `forumThreads/${thread.id}/replies`,
    {},
    "createdAt",
    "asc",
    20,
  );
  useEffect(() => {
    if (!user) {
      setCanModerate(false);
      return;
    }
    user
      .getIdTokenResult()
      .then((t) =>
        setCanModerate(t.claims.admin === true || t.claims.moderator === true),
      );
  }, [user]);
  async function editPost(id?: string, current = thread.body) {
    const body = await requestText("Edit your post", current);
    if (body === null) return;
    try {
      if (id) {
        await updateDoc(doc(db, "forumThreads", thread.id, "replies", id), {
          body: body.trim(),
          updatedAt: Date.now(),
        });
        replies.refresh();
      } else {
        threadSchema.parse({ ...thread, body });
        await updateDoc(doc(db, "forumThreads", thread.id), {
          body,
          searchTokens: tokens(`${thread.title} ${body}`),
          updatedAt: Date.now(),
        });
        setThread({ ...thread, body });
      }
    } catch (e) {
      setNotice(dataError(e));
    }
  }
  async function removePost(id?: string) {
    if (
      !(await confirmAction(
        "Remove this post? The discussion history will retain a removal notice.",
      ))
    )
      return;
    try {
      await updateDoc(
        id
          ? doc(db, "forumThreads", thread.id, "replies", id)
          : doc(db, "forumThreads", thread.id),
        {
          body: "[Post removed]",
          status: canModerate ? "hidden" : "deleted",
          updatedAt: Date.now(),
        },
      );
      if (id) replies.refresh();
      else location.href = "/forum";
    } catch (e) {
      setNotice(dataError(e));
    }
  }
  return (
    <section className="reading-panel">
      <Link href="/forum">← All discussions</Link>
      <div className="eyebrow">
        {forumCategories[thread.category as keyof typeof forumCategories]?.[0]}
        {thread.locked ? " · LOCKED" : ""}
      </div>
      <h1>{thread.title}</h1>
      <p className="muted">
        <Link href={`/seller/${thread.ownerId}`}>{thread.authorName}</Link> ·{" "}
        {new Date(thread.createdAt).toLocaleString("en-ZA")}
      </p>
      <ContentText text={thread.body} />
      <div className="manage-row">
        {user?.uid === thread.ownerId && (
          <button onClick={() => editPost()}>Edit original post</button>
        )}
        {(user?.uid === thread.ownerId || canModerate) && (
          <button onClick={() => removePost()}>Remove topic</button>
        )}
        {user && (
          <button
            onClick={() =>
              reportContent(user, "forum", thread.id)
                .then(() =>
                  setNotice(
                    "If submitted, the report is available to moderators.",
                  ),
                )
                .catch((e) => setNotice(dataError(e)))
            }
          >
            Report topic
          </button>
        )}
        {canModerate && user && (
          <button
            onClick={async () => {
              try {
                await moderateContent(
                  user,
                  "forumThreads",
                  thread.id,
                  { locked: !thread.locked },
                  thread.locked ? "unlock" : "lock",
                );
                setThread({ ...thread, locked: !thread.locked });
              } catch (e) {
                setNotice(dataError(e));
              }
            }}
          >
            {thread.locked ? "Unlock" : "Lock"} discussion
          </button>
        )}
      </div>
      <h2>Replies</h2>
      {replies.error && <p className="notice error">{replies.error}</p>}
      {replies.busy && !replies.items.length && (
        <LoadingState label="Loading replies…" />
      )}
      {replies.items.map((r) => (
        <article className="forum-reply" key={r.id}>
          <div className="byline">
            <Link href={`/seller/${r.ownerId}`}>{r.authorName}</Link>
            <time>{new Date(r.createdAt).toLocaleString("en-ZA")}</time>
          </div>
          <ContentText text={r.body} />
          <div className="manage-row">
            {user?.uid === r.ownerId && (
              <button onClick={() => editPost(r.id, r.body)}>Edit</button>
            )}
            {(user?.uid === r.ownerId || canModerate) && (
              <button onClick={() => removePost(r.id)}>Remove</button>
            )}
            {user && (
              <button
                onClick={() =>
                  reportContent(user, "forum", thread.id, r.id).catch((e) =>
                    setNotice(dataError(e)),
                  )
                }
              >
                Report reply
              </button>
            )}
          </div>
        </article>
      ))}
      {replies.more && (
        <button onClick={replies.loadMore} disabled={replies.busy}>
          {replies.busy && <RoostLoader size={40} label="Loading replies" />}{" "}
          Older to newer: load next replies
        </button>
      )}
      {thread.locked ? (
        <p className="notice">This discussion is locked.</p>
      ) : user ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await createReply(user, thread.id, { body });
              setBody("");
              replies.refresh();
              setNotice("Reply published.");
            } catch (error) {
              setNotice(dataError(error));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Join the discussion (YouTube and Vimeo links work here too)
            <textarea
              rows={5}
              required
              minLength={2}
              maxLength={6000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <button className="button" disabled={busy}>
            {busy && <RoostLoader size={40} label="Posting reply" />} Post reply
          </button>
        </form>
      ) : (
        <Link className="button" href="/auth">
          Sign in to reply
        </Link>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
