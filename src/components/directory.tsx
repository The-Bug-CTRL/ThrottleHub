"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  doc,
  setDoc,
  writeBatch,
  QueryDocumentSnapshot,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  directoryCategories,
  directoryLabels,
  directorySchema,
  DirectoryKind,
  DirectoryPost,
  DirectoryInput,
} from "@/lib/directory";
import { provinces } from "@/lib/marketplace";
import { useRole } from "./use-role";
import { ContentText } from "./content-text";
import { LoadingState } from "./ui/primitives";
import { confirmAction, requestText } from "./ui/dialogs";
import { dataError } from "@/lib/errors";
const blank = (kind: DirectoryKind): DirectoryInput => ({
  kind,
  title: "",
  body: "",
  category: directoryCategories[kind][0],
  organisation: "",
  region: "",
  city: "",
  contactEmail: "",
  price: 0,
});
export function DirectoryBoard({
  section,
}: {
  section: "jobs" | "entries-services";
}) {
  const { user, moderator, checking } = useRole();
  const [kind, setKind] = useState<DirectoryKind>(
      section === "jobs" ? "job" : "entry",
    ),
    [scope, setScope] = useState("public"),
    [region, setRegion] = useState(""),
    [category, setCategory] = useState("");
  const [items, setItems] = useState<DirectoryPost[]>([]),
    [cursor, setCursor] = useState<QueryDocumentSnapshot>(),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const [form, setForm] = useState<DirectoryInput | null>(null),
    [editing, setEditing] = useState<DirectoryPost | null>(null),
    [saving, setSaving] = useState(false);
  const queryKey = `${scope}:${user?.uid}:${moderator}:${kind}:${region}:${category}`;
  const activeQuery = useRef(queryKey);
  activeQuery.current = queryKey;
  const load = useCallback(
    async (after?: QueryDocumentSnapshot) => {
      if (scope !== "public" && !user) return;
      if (scope === "moderation" && !moderator) return;
      setBusy(true);
      setError("");
      try {
        const constraints: QueryConstraint[] =
          scope === "mine"
            ? [where("ownerId", "==", user!.uid)]
            : scope === "moderation"
              ? [where("status", "==", "pending")]
              : [
                  where("status", "==", "published"),
                  where("country", "==", "ZA"),
                  where("kind", "==", kind),
                  ...(region ? [where("region", "==", region)] : []),
                  ...(category ? [where("category", "==", category)] : []),
                ];
        const page = await getDocs(
          query(
            collection(db, "directoryPosts"),
            ...constraints,
            orderBy("createdAt", "desc"),
            ...(after ? [startAfter(after)] : []),
            limit(21),
          ),
        );
        if (activeQuery.current !== queryKey) return;
        const docs = page.docs.slice(0, 20);
        setItems((old) =>
          after
            ? [
                ...old,
                ...docs.map(
                  (d) => ({ ...d.data(), id: d.id }) as DirectoryPost,
                ),
              ]
            : docs.map((d) => ({ ...d.data(), id: d.id }) as DirectoryPost),
        );
        setCursor(docs.at(-1));
        setMore(page.docs.length > 20);
      } catch (e) {
        setError(dataError(e));
      } finally {
        setBusy(false);
      }
    },
    [scope, user, moderator, kind, region, category, queryKey],
  );
  useEffect(() => {
    setItems([]);
    setCursor(undefined);
    setMore(false);
    void load();
  }, [load]);
  useEffect(() => {
    if (!user && scope !== "public") setScope("public");
    setForm(null);
    setEditing(null);
  }, [user, scope]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !form || saving) return;
    setSaving(true);
    setNotice("");
    try {
      const parsed = directorySchema.safeParse(form);
      if (!parsed.success) throw Error(parsed.error.issues[0].message);
      const target = editing
        ? doc(db, "directoryPosts", editing.id)
        : doc(collection(db, "directoryPosts"));
      await setDoc(target, {
        ...parsed.data,
        ownerId: user.uid,
        country: "ZA",
        status: "pending",
        createdAt: editing?.createdAt || Date.now(),
        updatedAt: Date.now(),
      });
      setForm(null);
      setEditing(null);
      setNotice("Post submitted. It will appear once a moderator approves it.");
      setScope("mine");
      if (scope === "mine") await load();
    } catch (e) {
      setNotice(dataError(e));
    } finally {
      setSaving(false);
    }
  }
  async function changeStatus(
    post: DirectoryPost,
    status: DirectoryPost["status"],
  ) {
    if (
      !user ||
      !(await confirmAction(
        `${status === "published" ? "Approve" : status === "rejected" ? "Reject" : "Archive"} this post?`,
      ))
    )
      return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "directoryPosts", post.id), {
        status,
        updatedAt: Date.now(),
      });
      if (moderator)
        batch.set(doc(collection(db, "communityActions")), {
          actorId: user.uid,
          targetCollection: "directoryPosts",
          targetId: post.id,
          action: `directory-${status}`,
          createdAt: Date.now(),
        });
      await batch.commit();
      setNotice("Post updated.");
      await load();
    } catch (e) {
      setNotice(dataError(e));
    }
  }
  async function report(post: DirectoryPost) {
    if (!user) return;
    const reason = await requestText(
      "What should a moderator check? (at least 10 characters)",
    );
    if (!reason || reason.trim().length < 10) return;
    try {
      await setDoc(doc(collection(db, "directoryFlags")), {
        targetId: post.id,
        replyId: "",
        reporterId: user.uid,
        reason: reason.trim().slice(0, 1500),
        status: "open",
        createdAt: Date.now(),
      });
      setNotice("Report sent to the moderation team.");
    } catch (e) {
      setNotice(dataError(e));
    }
  }
  return (
    <section className="wrap section directory-board">
      <div className="section-heading">
        <div>
          <div className="eyebrow">More from ThrottleHub</div>
          <h1>{section === "jobs" ? "Jobs" : "Entries & services"}</h1>
          <p>
            {section === "jobs"
              ? "Find work in the bike industry or find someone for your team."
              : "Race entries, workshops, transport and help for your next ride."}
          </p>
        </div>
        {user ? (
          <button
            className="button"
            onClick={() => {
              setEditing(null);
              setForm(blank(kind));
              setNotice("");
            }}
          >
            Post{" "}
            {kind === "job"
              ? "a job"
              : kind === "entry"
                ? "an entry"
                : "a service"}
          </button>
        ) : (
          <Link className="button" href="/auth">
            Sign in to post
          </Link>
        )}
      </div>
      <nav className="directory-tabs" aria-label="Directory sections">
        {(section === "jobs" ? ["job"] : ["entry", "service"]).map((value) => (
          <button
            className={`text-button ${kind === value ? "active" : ""}`}
            key={value}
            onClick={() => {
              setForm(null);
              setEditing(null);
              setKind(value as DirectoryKind);
              setScope("public");
              setCategory("");
            }}
          >
            {directoryLabels[value as DirectoryKind]}
          </button>
        ))}
        <button
          className={`text-button ${scope === "public" ? "active" : ""}`}
          onClick={() => setScope("public")}
        >
          Browse posts
        </button>
        {user && (
          <button
            className={`text-button ${scope === "mine" ? "active" : ""}`}
            onClick={() => setScope("mine")}
          >
            Your posts
          </button>
        )}
        {moderator && (
          <button
            className={`text-button ${scope === "moderation" ? "active" : ""}`}
            onClick={() => setScope("moderation")}
          >
            Approval queue
          </button>
        )}
      </nav>
      {scope === "public" && (
        <div className="directory-filters">
          <label>
            Province
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">All provinces</option>
              {Object.entries(provinces).map(([code, name]) => (
                <option value={code} key={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {directoryCategories[kind].map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      {form && (
        <form className="directory-form" onSubmit={save}>
          <h2>{editing ? "Edit your post" : "New post"}</h2>
          <p>
            New posts and edits are checked before they appear. Your contact
            email will be public on this post.
          </p>
          <label>
            Category
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {directoryCategories[form.kind].map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input
              required
              minLength={8}
              maxLength={140}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label>
            Business, club or organiser (optional)
            <input
              maxLength={120}
              value={form.organisation}
              onChange={(e) =>
                setForm({ ...form, organisation: e.target.value })
              }
            />
          </label>
          <div className="field-row">
            <label>
              Province
              <select
                required
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
              >
                <option value="">Choose province</option>
                {Object.entries(provinces).map(([code, name]) => (
                  <option value={code} key={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Town / city
              <input
                required
                minLength={2}
                maxLength={80}
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </label>
          </div>
          <label>
            Details
            <textarea
              required
              rows={6}
              minLength={20}
              maxLength={6000}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </label>
          {form.kind !== "job" && (
            <label>
              Price in rand (0 if negotiable or not set)
              <input
                type="number"
                min={0}
                max={10000000}
                value={form.price}
                onChange={(e) =>
                  setForm({ ...form, price: Number(e.target.value) })
                }
              />
            </label>
          )}
          <label>
            Public contact email
            <input
              type="email"
              required
              maxLength={254}
              value={form.contactEmail}
              onChange={(e) =>
                setForm({ ...form, contactEmail: e.target.value })
              }
            />
          </label>
          <div className="manage-row">
            <button className="button" disabled={saving}>
              {saving ? "Submitting..." : "Submit for approval"}
            </button>
            <button
              type="button"
              className="text-button"
              disabled={saving}
              onClick={() => {
                setForm(null);
                setEditing(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
          <button className="text-button" onClick={() => load()}>
            Try again
          </button>
        </p>
      )}
      {checking && scope === "moderation" && (
        <LoadingState label="Checking access..." />
      )}
      <div className="directory-grid">
        {items.map((post) => (
          <article className="directory-card" key={post.id}>
            <div className="eyebrow">
              {directoryLabels[post.kind]} · {post.category}
            </div>
            <h2>
              {post.status === "published" ? (
                <Link href={`/community-listings/${post.id}`}>
                  {post.title}
                </Link>
              ) : (
                post.title
              )}
            </h2>
            <p>{post.organisation}</p>
            <p>
              {post.city}, {provinces[post.region as keyof typeof provinces]}
            </p>
            <ContentText
              text={
                scope === "moderation"
                  ? post.body
                  : post.body.slice(0, 250) +
                    (post.body.length > 250 ? "..." : "")
              }
            />
            {post.price > 0 && <b>R{post.price.toLocaleString("en-ZA")}</b>}
            {scope !== "public" && (
              <span className="status-badge">{post.status}</span>
            )}
            <div className="manage-row">
              {user?.uid === post.ownerId && (
                <>
                  <button
                    onClick={() => {
                      setEditing(post);
                      setForm({ ...post });
                    }}
                  >
                    Edit
                  </button>
                  {post.status !== "archived" && (
                    <button onClick={() => changeStatus(post, "archived")}>
                      Archive
                    </button>
                  )}
                </>
              )}
              {moderator && (
                <>
                  {post.status !== "published" && (
                    <button onClick={() => changeStatus(post, "published")}>
                      Approve
                    </button>
                  )}
                  {post.status === "pending" && (
                    <button onClick={() => changeStatus(post, "rejected")}>
                      Reject
                    </button>
                  )}
                  {post.status === "published" && (
                    <button onClick={() => changeStatus(post, "archived")}>
                      Hide
                    </button>
                  )}
                </>
              )}
              {scope === "public" && user && user.uid !== post.ownerId && (
                <button className="text-button" onClick={() => report(post)}>
                  Report
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {busy && <LoadingState label="Loading posts..." />}
      {!busy && !error && !items.length && (
        <div className="empty-state">
          <h2>
            {scope === "moderation"
              ? "Nothing waiting for approval."
              : scope === "mine"
                ? "You have not posted anything yet."
                : "No posts here yet."}
          </h2>
          <p>
            {scope === "public"
              ? "Try another province or be the first to post."
              : "Your posts and their approval status will appear here."}
          </p>
        </div>
      )}
      {more && (
        <button
          className="button-secondary"
          disabled={busy}
          onClick={() => load(cursor)}
        >
          Load more posts
        </button>
      )}
    </section>
  );
}
