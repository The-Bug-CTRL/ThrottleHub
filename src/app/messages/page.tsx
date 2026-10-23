"use client";
import { RoostLoader } from "@/components/loading/roost-loader";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import {
  MessageCircle,
  ArrowLeft,
  ArrowUpRight,
  Send,
  ShieldCheck,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { dataError } from "@/lib/errors";
import { useSession } from "@/components/session";
import { LoadingState } from "@/components/ui/primitives";
interface Conversation {
  id: string;
  listingId: string;
  listingTitle: string;
  participants: string[];
  buyerId: string;
  sellerId: string;
  createdAt: number;
  readAt?: Record<string, number>;
}
interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: number;
}
export default function Messages() {
  const { user, loading } = useSession();
  const [conversations, setConversations] = useState<Conversation[]>([]),
    [selected, setSelected] = useState(""),
    [messages, setMessages] = useState<Message[]>([]),
    [text, setText] = useState(""),
    [notice, setNotice] = useState(""),
    [sending, setSending] = useState(false),
    [latest, setLatest] = useState<Record<string, Message>>({}),
    [names, setNames] = useState<Record<string, string>>({}),
    [listingUrl, setListingUrl] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setSelected(new URLSearchParams(location.search).get("conversation") || "");
  }, []);
  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(
        collection(db, "conversations"),
        where("participants", "array-contains", user.uid),
        limit(30),
      ),
      (s) =>
        setConversations(
          s.docs.map((d) => ({ ...d.data(), id: d.id }) as Conversation),
        ),
      (error) => setNotice(dataError(error)),
    );
  }, [user]);
  const ids = conversations.map((c) => c.id).join(",");
  useEffect(() => {
    if (!user) return;
    const active = conversations;
    const stops = active.map((c) =>
      onSnapshot(
        query(
          collection(db, "conversations", c.id, "messages"),
          orderBy("createdAt", "desc"),
          limit(1),
        ),
        (s) => {
          if (!s.empty)
            setLatest((old) => ({
              ...old,
              [c.id]: { ...s.docs[0].data(), id: s.docs[0].id } as Message,
            }));
        },
        () => {},
      ),
    );
    let cancelled = false;
    for (const uid of new Set(
      active.map((c) => (c.buyerId === user.uid ? c.sellerId : c.buyerId)),
    ))
      getDoc(doc(db, "profiles", uid))
        .then((d) => {
          if (!cancelled && d.exists())
            setNames((old) => ({ ...old, [uid]: d.data().displayName }));
        })
        .catch(() => {});
    return () => {
      cancelled = true;
      stops.forEach((stop) => stop());
    };
  }, [ids, user]);
  useEffect(() => {
    setMessages([]);
    setListingUrl("");
    if (!user || !selected) return;
    return onSnapshot(
      query(
        collection(db, "conversations", selected, "messages"),
        orderBy("createdAt", "desc"),
        limit(50),
      ),
      (s) => {
        setMessages(
          s.docs.map((d) => ({ ...d.data(), id: d.id }) as Message).reverse(),
        );
        void updateDoc(doc(db, "conversations", selected), {
          [`readAt.${user.uid}`]: Date.now(),
        }).catch((error) => setNotice(dataError(error)));
      },
      (error) => setNotice(dataError(error)),
    );
  }, [selected, user]);
  const current = conversations.find((c) => c.id === selected);
  useEffect(() => {
    if (!current) return;
    let active = true;
    getDoc(doc(db, "listings", current.listingId))
      .then((d) => {
        if (active && d.exists() && d.data().status === "published")
          setListingUrl(`/listing/${d.id}/${d.data().slug}`);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [current?.listingId]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);
  if (loading)
    return (
      <div className="wrap">
        <LoadingState label="Opening your inbox…" />
      </div>
    );
  if (!user)
    return (
      <div className="auth-panel">
        <MessageCircle size={30} />
        <h1>Keep the conversation going.</h1>
        <p>
          Ask about the bike. Confirm the details. Plan your next chapter,
          privately.
        </p>
        <Link className="button" href="/auth">
          Sign in to messages
        </Link>
      </div>
    );
  const other = current
    ? current.buyerId === user.uid
      ? current.sellerId
      : current.buyerId
    : "";
  const sorted = [...conversations].sort(
    (a, b) =>
      (latest[b.id]?.createdAt || b.createdAt) -
      (latest[a.id]?.createdAt || a.createdAt),
  );
  return (
    <section className="wrap section">
      <div className="eyebrow">Your riding connections</div>
      <div className="section-heading">
        <h1>Messages</h1>
        <Link href="/account">
          Back to my garage <ArrowUpRight size={16} />
        </Link>
      </div>
      {notice && (
        <p role="alert" className="notice error">
          {notice}
        </p>
      )}
      <div className={`inbox ${selected ? "has-selected" : ""}`}>
        <aside>
          <h3>
            Conversations <small>({conversations.length})</small>
          </h3>
          {!conversations.length && (
            <p>
              No conversations yet. Find an item you like and message its
              seller.
            </p>
          )}
          {sorted.map((c) => {
            const last = latest[c.id],
              uid = c.buyerId === user.uid ? c.sellerId : c.buyerId;
            const unread =
              last &&
              last.senderId !== user.uid &&
              last.createdAt > (c.readAt?.[user.uid] || 0);
            return (
              <button
                className={selected === c.id ? "active" : ""}
                aria-pressed={selected === c.id}
                key={c.id}
                onClick={() => {
                  setSelected(c.id);
                  setNotice("");
                }}
              >
                <strong>{names[uid] || "Marketplace member"}</strong>
                <small>{c.listingTitle}</small>
                <span className="conversation-preview">
                  {last
                    ? `${last.senderId === user.uid ? "You: " : ""}${last.text}`
                    : "Start a conversation"}
                </span>
                <small>
                  {c.buyerId === user.uid ? "Buying" : "Selling"}
                  {last
                    ? ` · ${new Date(last.createdAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`
                    : ""}
                </small>
                {unread && (
                  <span className="unread-dot" aria-label="Unread message" />
                )}
              </button>
            );
          })}
        </aside>
        <div className="conversation">
          {selected ? (
            <>
              <div className="conversation-heading">
                <button
                  className="icon-button inbox-back"
                  aria-label="Back to conversation list"
                  onClick={() => setSelected("")}
                >
                  <ArrowLeft size={20} />
                </button>
                <span className="avatar">
                  {(names[other] || "R").slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <Link href={`/seller/${other}#reviews`}>
                    <b>{names[other] || "Marketplace member"}</b>
                    <span className="conversation-review-link">
                      {" "}
                      Profile &amp; reviews &rarr;
                    </span>
                  </Link>
                  <small>
                    {current?.listingTitle || "Private conversation"}
                  </small>
                </div>
                {listingUrl && (
                  <Link href={listingUrl}>
                    View listing <ArrowUpRight size={14} />
                  </Link>
                )}
              </div>
              <div className="message-list" aria-label="Conversation messages">
                {messages.map((m) => (
                  <div
                    className={`message ${m.senderId === user.uid ? "mine" : ""}`}
                    key={m.id}
                  >
                    <p>{m.text}</p>
                    <small>
                      {new Date(m.createdAt).toLocaleString("en-ZA", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </div>
                ))}
                {!messages.length && (
                  <p className="muted">
                    Start with a question about the item’s condition, fitment or
                    collection.
                  </p>
                )}
                <div ref={bottom} />
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!text.trim() || sending) return;
                  setSending(true);
                  try {
                    await addDoc(
                      collection(db, "conversations", selected, "messages"),
                      {
                        senderId: user.uid,
                        text: text.trim(),
                        createdAt: Date.now(),
                      },
                    );
                    setText("");
                  } catch (error) {
                    setNotice(dataError(error));
                  } finally {
                    setSending(false);
                  }
                }}
              >
                <textarea
                  rows={1}
                  aria-label="Your message"
                  maxLength={2000}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write a message…"
                  required
                />
                <button className="button" disabled={sending || !text.trim()}>
                  {sending ? (
                    <RoostLoader size={40} label="Sending message" />
                  ) : (
                    <Send size={17} />
                  )}
                  <span>{sending ? "Sending…" : "Send"}</span>
                </button>
              </form>
              <small>
                <ShieldCheck size={12} /> Keep sensitive payment and identity
                information out of messages. Latest 50 messages shown.
              </small>
            </>
          ) : (
            <div className="empty">
              <MessageCircle size={32} />
              <h2>Rider to rider.</h2>
              <p>
                Choose a conversation to continue, or find your next item in the
                marketplace.
              </p>
              <Link className="text-button" href="/browse">
                Explore the marketplace <ArrowUpRight size={15} />
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
