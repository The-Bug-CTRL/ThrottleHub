"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, MessageCircle, Star, MessagesSquare } from "lucide-react";
import { useSession } from "./session";
import type { ActivityNotification } from "@/lib/notification-feed";
export function Notifications() {
  const { user } = useSession(),
    [open, setOpen] = useState(false),
    [items, setItems] = useState<
      (ActivityNotification & { unread: boolean })[]
    >([]),
    [unread, setUnread] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const currentUid = useRef(user?.uid);
  currentUid.current = user?.uid;
  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      if (currentUid.current !== user.uid) return;
      setItems(data.items);
      setUnread(data.unread);
      setError("");
    } catch (e) {
      if (currentUid.current !== user?.uid) return;
      setError(
        e instanceof Error ? e.message : "Could not load notifications.",
      );
    } finally {
      if (currentUid.current === user?.uid) setBusy(false);
    }
  }, [user]);
  useEffect(() => {
    setItems([]);
    setUnread(0);
    setOpen(false);
    setError("");
    if (!user) return;
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60000);
    return () => clearInterval(timer);
  }, [user, load]);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  async function markRead(item?: ActivityNotification) {
    if (!user || !items.length) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(item
            ? { id: item.id }
            : { through: Math.max(...items.map((item) => item.createdAt)) }),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      if (currentUid.current !== user.uid) return;
      setItems((old) =>
        old.map((event) =>
          !item || event.id === item.id ? { ...event, unread: false } : event,
        ),
      );
      if (item)
        setUnread((old) =>
          items.find((event) => event.id === item.id)?.unread
            ? Math.max(0, old - 1)
            : old,
        );
      else setUnread(0);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not mark notifications read.",
      );
    }
  }
  return (
    <div
      className="notifications"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        className="header-icon notification-trigger"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => {
          setOpen(!open);
          if (!open) void load();
        }}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="notification-count" aria-hidden="true">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <section
          id="notification-panel"
          className="notification-panel"
          aria-label="Notifications"
        >
          <header>
            <h2>Notifications</h2>
            {user && unread > 0 && (
              <button className="text-button" onClick={() => markRead()}>
                Mark all read
              </button>
            )}
          </header>
          {!user ? (
            <p>
              <Link href="/auth">Sign in</Link> to see messages, replies and
              reviews.
            </p>
          ) : error ? (
            <p role="alert">
              {error}
              <button className="text-button" onClick={() => load()}>
                Try again
              </button>
            </p>
          ) : (
            <>
              {busy && !items.length && (
                <p role="status">Checking for updates...</p>
              )}
              {!busy && !items.length && (
                <p>
                  No updates yet. Messages, replies to your discussions and
                  profile reviews will show up here.
                </p>
              )}
              <div className="notification-list">
                {items.map((item) => {
                  const Icon =
                    item.kind === "message"
                      ? MessageCircle
                      : item.kind === "review"
                        ? Star
                        : MessagesSquare;
                  return (
                    <Link
                      key={item.id}
                      className={item.unread ? "unread" : ""}
                      href={item.href}
                      onClick={() => {
                        setOpen(false);
                        void markRead(item);
                      }}
                    >
                      <Icon size={18} />
                      <div>
                        <b>{item.title}</b>
                        <span>{item.description}</span>
                        <small>
                          {new Date(item.createdAt).toLocaleString("en-ZA", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </small>
                      </div>
                      {item.unread && (
                        <span className="unread-dot" aria-label="Unread" />
                      )}
                    </Link>
                  );
                })}
              </div>
              <small className="notification-note">
                Recent activity · updates every minute
              </small>
            </>
          )}
        </section>
      )}
    </div>
  );
}
