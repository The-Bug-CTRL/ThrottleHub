"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
export { SupportBadge } from "./support-notifications";
import { doc, onSnapshot } from "firebase/firestore";
import { supportGuestToken } from "@/lib/support-app-check";
import { db } from "@/lib/firebase";
import { supportCategories, supportStatuses } from "@/lib/support-model";
import { useSession } from "./session";
import { useRole } from "./use-role";
import { AdminNavigation } from "./admin-navigation";
type Ticket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
  openedAt: number | null;
  listingRef: string;
  orderRef: string;
  customer?: {
    displayName: string;
    accountType: string;
    region: string;
    city: string;
  };
};
type Message = {
  id: string;
  text?: string;
  action?: string;
  staff: boolean;
  createdAt: number;
};
function SupportImage({
  ticket,
  id,
  headers,
}: {
  ticket: string;
  id: string;
  headers: () => Promise<Record<string, string>>;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true,
      object = "";
    void headers()
      .then((h) =>
        fetch(`/api/support?id=${ticket}&attachment=${id}`, { headers: h }),
      )
      .then(async (r) => {
        if (!r.ok) return;
        object = URL.createObjectURL(await r.blob());
        if (active) setUrl(object);
        else URL.revokeObjectURL(object);
      })
      .catch(() => {});
    return () => {
      active = false;
      if (object) URL.revokeObjectURL(object);
    };
  }, [ticket, id, headers]);
  return url ? (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="Support screenshot — open full image" />
    </a>
  ) : (
    <span>Screenshot unavailable or loading.</span>
  );
}
export function SupportCentre({ staff = false }: { staff?: boolean }) {
  const { user, loading } = useSession(),
    { admin, checking, error: roleError } = useRole();
  const [items, setItems] = useState<Ticket[]>([]),
    [ticket, setTicket] = useState<Ticket | null>(null),
    [messages, setMessages] = useState<Message[]>([]),
    [attachments, setAttachments] = useState<{ id: string }[]>([]);
  const [next, setNext] = useState<string | null>(null),
    [older, setOlder] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [text, setText] = useState(""),
    [section, setSection] = useState("messages"),
    [filter, setFilter] = useState(""),
    [sort, setSort] = useState(""),
    [search, setSearch] = useState("");
  const [guest, setGuest] = useState(""),
    [stats, setStats] = useState<Record<string, number>>({});
  const [categoryFilter, setCategoryFilter] = useState(""),
    [priorityFilter, setPriorityFilter] = useState("");
  const identity = useRef(user?.uid || guest);
  const activeConversation = useRef("");
  identity.current = user?.uid || guest;
  useEffect(() => {
    setItems([]);
    setTicket(null);
    setMessages([]);
    setAttachments([]);
    setStats({});
    setText("");
  }, [user?.uid, guest]);
  const headers = useCallback(
    async (): Promise<Record<string, string>> =>
      user
        ? { Authorization: `Bearer ${await user.getIdToken()}` }
        : { "x-support-access": guest },
    [user, guest],
  );
  const request = useCallback(
    async (suffix = "", init?: RequestInit) => {
      const expectedIdentity = identity.current;
      const response = await fetch(`/api/support${suffix}`, {
        ...init,
        headers: { ...(await headers()), ...init?.headers },
      });
      const data = await response.json();
      if (identity.current !== expectedIdentity)
        throw Error("Account changed. Open support again.");
      if (!response.ok) throw Error(data.error);
      return data;
    },
    [headers],
  );
  const list = useCallback(
    async (after?: string) => {
      const data = await request(
        `?${filter}&sort=${sort}${categoryFilter ? `&category=${encodeURIComponent(categoryFilter)}` : ""}${priorityFilter ? `&priority=${priorityFilter}` : ""}${after ? `&after=${after}` : ""}`,
      );
      setItems((old) => (after ? [...old, ...data.items] : data.items));
      setNext(data.next);
    },
    [request, filter, sort, categoryFilter, priorityFilter],
  );
  const open = useCallback(
    async (id: string, after?: string, tab = "messages") => {
      const data = await request(
        `?id=${encodeURIComponent(id)}&section=${tab}${after ? `&after=${after}` : ""}`,
      );
      // Never carry a private-note draft into a public reply or another ticket.
      if (activeConversation.current !== `${id}:${tab}`) setText("");
      activeConversation.current = `${id}:${tab}`;
      setTicket(data.ticket);
      setMessages((old) => (after ? [...old, ...data.items] : data.items));
      setAttachments(data.attachments);
      setOlder(data.next);
      setSection(tab);
      if (!after)
        await request("", {
          method: "POST",
          body: JSON.stringify({ action: "read", id }),
        });
    },
    [request],
  );
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("ticket");
    if (user && id && (!staff || admin))
      void open(id).catch((e) => setError(e.message));
  }, [user, staff, admin, open]);
  useEffect(() => {
    if (user && (!staff || admin))
      void list().catch((e) => setError(e.message));
  }, [user, staff, admin, list]);
  useEffect(() => {
    if (!user || (staff && !admin)) return;
    return onSnapshot(
      doc(db, "supportSignals", staff ? "staff" : `user-${user.uid}`),
      (s) => {
        setStats(s.data() || {});
      },
      () =>
        setError(
          "Live support alerts are unavailable. Refresh to check for replies.",
        ),
    );
  }, [user, staff, admin]);
  const mutate = (action: string, extra = {}) =>
    run(async () => {
      await request("", {
        method: "POST",
        body: JSON.stringify({ action, id: ticket!.id, ...extra }),
      });
      await open(
        ticket!.id,
        undefined,
        action === "note" ? "notes" : "messages",
      );
      await list();
      setText("");
    });
  if (loading || (staff && checking))
    return <div className="wrap">Loading support…</div>;
  if (staff && !admin)
    return (
      <div className="wrap">
        <h1>Administrator access required</h1>
        {user ? <><p>{roleError || "You are signed in, but this account does not have administrator access."}</p><Link href="/account">Back to My Account</Link></> : <Link href="/auth">Sign in</Link>}
      </div>
    );
  return (
    <section className="wrap support-centre">
      <h1>{staff ? "Support inbox" : "Help & support"}</h1>
      {staff && <AdminNavigation />}
      <p>
        Need a hand with ThrottleHub? Send us a request. Never share passwords,
        card details or payment secrets.
      </p>
      {!staff && (
        <p>
          <Link href="/info/help">Getting started</Link> ·{" "}
          <Link href="/auth">Sign in or reset your password</Link>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {staff && (
        <div className="support-stats">
          {["open", "unread", "waiting", "customer", "resolved", "high"].map(
            (k) => (
              <div key={k}>
                <strong>{stats[k] || 0}</strong>
                <span>
                  {
                    {
                      open: "Open",
                      unread: "Unread",
                      waiting: "Waiting for staff",
                      customer: "Waiting for customer",
                      resolved: "Resolved",
                      high: "High priority",
                    }[k]
                  }
                </span>
              </div>
            ),
          )}
        </div>
      )}
      {!user && (
        <div className="support-panel">
          <h2>Can’t access your account?</h2>
          <p>
            Sign in for support, or use your saved guest access key. Guest
            creation requires the site security check. Keys grant access to your
            conversation: keep them private. We cannot email or recover a lost
            key.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                const token = await supportGuestToken();
                const data = await request("?guest=create", {
                  method: "POST",
                  headers: { "x-firebase-appcheck": token },
                  body: JSON.stringify({
                    action: "create",
                    category: "Account & Login",
                    subject: f.get("subject"),
                    text: f.get("description"),
                  }),
                });
                setGuest(data.credential);
                setSearch(data.id);
              });
            }}
          >
            <label>
              Subject
              <input name="subject" required minLength={3} maxLength={160} />
            </label>
            <label>
              Describe the login problem
              <textarea name="description" required maxLength={6000} />
            </label>
            <button disabled={busy}>Send guest request</button>
          </form>
          <p>
            After sending, save the reference and access key below, then select
            Open request. Show the key only somewhere private.
          </p>
          <label>
            Guest access key
            <input
              type="text"
              value={guest}
              onChange={(e) => setGuest(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label>
            Support reference
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <button
            disabled={busy}
            onClick={() => void run(() => open(search.trim()))}
          >
            Open request
          </button>
        </div>
      )}
      {(user || ticket) && (
        <div className="support-layout">
          <aside className="support-panel">
            <h2>{staff ? "Customer requests" : "Your requests"}</h2>
            {staff && (
              <>
                <label>
                  Filter
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="">All tickets</option>
                    {supportStatuses.map((s) => (
                      <option key={s} value={`status=${s}`}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Category
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="">All categories</option>
                    {supportCategories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Priority
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                  >
                    <option value="">All priorities</option>
                    <option>normal</option>
                    <option>high</option>
                  </select>
                </label>
                <label>
                  Sort
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="">Recently updated</option>
                    <option value="oldest">Oldest waiting</option>
                  </select>
                </label>
                <label>
                  Exact reference
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <button onClick={() => void run(() => open(search.trim()))}>
                  Find ticket
                </button>
              </>
            )}
            <button disabled={busy} onClick={() => void run(() => list())}>
              Refresh requests
            </button>
            {!items.length && <p>No support requests yet.</p>}
            {items.map((t) => (
              <button
                className="support-ticket"
                key={t.id}
                onClick={() => void run(() => open(t.id))}
              >
                <strong>{t.subject}</strong>
                <small>{t.id}</small>
                <span>
                  {t.status} · {t.priority}
                </span>
              </button>
            ))}
            {next && (
              <button onClick={() => void run(() => list(next))}>
                More requests
              </button>
            )}
            {!staff && user && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void run(async () => {
                    const data = await request("", {
                      method: "POST",
                      body: JSON.stringify({
                        action: "create",
                        subject: f.get("subject"),
                        category: f.get("category"),
                        text: f.get("description"),
                        ...(f.get("listingRef")
                          ? { listingRef: f.get("listingRef") }
                          : {}),
                        ...(f.get("orderRef")
                          ? { orderRef: f.get("orderRef") }
                          : {}),
                      }),
                    });
                    await list();
                    await open(data.id);
                  });
                }}
              >
                <h2>New request</h2>
                <label>
                  Category
                  <select name="category">
                    {supportCategories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Subject
                  <input
                    name="subject"
                    required
                    minLength={3}
                    maxLength={160}
                  />
                </label>
                <label>
                  What happened?
                  <textarea
                    name="description"
                    required
                    maxLength={6000}
                    rows={5}
                  />
                </label>
                <label>
                  Listing ID (optional)
                  <input name="listingRef" maxLength={128} />
                </label>
                <label>
                  Payment order reference (optional)
                  <input name="orderRef" maxLength={128} />
                </label>
                <button disabled={busy}>Send request</button>
              </form>
            )}
          </aside>
          <div className="support-panel">
            {ticket ? (
              <>
                <h2>{ticket.subject}</h2>
                <p>
                  {ticket.id} · {ticket.category}
                </p>
                <p>
                  {ticket.status} ·{" "}
                  {ticket.openedAt ? "Opened by support" : "Not opened yet"}
                </p>
                <p>
                  Created {new Date(ticket.createdAt).toLocaleString()} ·
                  Updated {new Date(ticket.updatedAt).toLocaleString()}
                </p>
                {ticket.listingRef && (
                  <p>Listing reference: {ticket.listingRef}</p>
                )}
                {ticket.orderRef && (
                  <p>Order reference: {ticket.orderRef} (reference only)</p>
                )}
                {staff && (
                  <>
                    <p>
                      Customer: {ticket.customer?.displayName || ticket.ownerId}
                      {ticket.customer &&
                        ` · ${ticket.customer.accountType} · ${ticket.customer.city} ${ticket.customer.region}`}
                    </p>
                    <Link
                      href={`/seller/${encodeURIComponent(ticket.ownerId)}`}
                    >
                      Public profile
                    </Link>
                    <button
                      onClick={() => {
                        setFilter(
                          `ownerId=${encodeURIComponent(ticket.ownerId)}`,
                        );
                      }}
                    >
                      Previous requests
                    </button>
                    <label>
                      Priority
                      <select
                        value={ticket.priority}
                        onChange={(e) =>
                          void mutate("priority", { priority: e.target.value })
                        }
                      >
                        <option>normal</option>
                        <option>high</option>
                      </select>
                    </label>
                    <div>
                      {["messages", "notes", "activity"].map((s) => (
                        <button
                          key={s}
                          onClick={() =>
                            void run(() => open(ticket.id, undefined, s))
                          }
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <div className="support-conversation">
                  {[...messages].reverse().map((m) => (
                    <article key={m.id}>
                      <strong>
                        {m.staff ? "ThrottleHub support" : "Customer"}
                      </strong>
                      <small>{new Date(m.createdAt).toLocaleString()}</small>
                      <p>{m.text || m.action}</p>
                    </article>
                  ))}
                </div>
                {older && (
                  <button
                    onClick={() =>
                      void run(() => open(ticket.id, older, section))
                    }
                  >
                    Earlier messages
                  </button>
                )}
                <div className="support-images">
                  {attachments.map((a) => (
                    <SupportImage
                      key={a.id}
                      ticket={ticket.id}
                      id={a.id}
                      headers={headers}
                    />
                  ))}
                </div>
                {ticket.status !== "resolved" && (
                  <>
                    <label>
                      Add screenshot (JPEG, PNG or WebP, up to 5 MB)
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={busy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file)
                            void run(async () => {
                              if (file.size > 5 * 1024 * 1024)
                                throw Error("Use an image under 5 MB.");
                              await request(`?id=${ticket.id}`, {
                                method: "PUT",
                                body: file,
                              });
                              await open(ticket.id);
                            });
                        }}
                      />
                    </label>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void mutate(
                          section === "notes" && staff ? "note" : "reply",
                          { text },
                        );
                      }}
                    >
                      <label>
                        {section === "notes" ? "Private staff note" : "Reply"}
                        <textarea
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                          maxLength={6000}
                          required
                          rows={5}
                        />
                      </label>
                      <button disabled={busy}>
                        Send {section === "notes" ? "private note" : "reply"}
                      </button>
                    </form>
                  </>
                )}
                <button
                  disabled={busy}
                  onClick={() =>
                    void mutate("status", {
                      status:
                        ticket.status === "resolved"
                          ? "waiting-staff"
                          : "resolved",
                    })
                  }
                >
                  {ticket.status === "resolved"
                    ? "Reopen request"
                    : "Resolve request"}
                </button>
                {staff && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void mutate("status", { status: "waiting-customer" })
                    }
                  >
                    Request more information
                  </button>
                )}
                <button
                  disabled={busy}
                  onClick={() => void run(() => open(ticket.id))}
                >
                  Check for replies
                </button>
              </>
            ) : (
              <p>Select a request to read the conversation.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
