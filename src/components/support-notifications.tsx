"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CreditCard, LifeBuoy, ShieldCheck } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRole } from "./use-role";

const Context = createContext({ admin: false, count: 0, enabled: false, permission: "unavailable", notice: "", toggle: async () => {} });
export function SupportNotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user, admin, checking } = useRole();
  const [count, setCount] = useState(0), [enabled, setEnabled] = useState(false),
    [permission, setPermission] = useState("unavailable"), [notice, setNotice] = useState("");
  const enabledRef = useRef(false);
  const identity = useRef("");
  useEffect(() => {
    identity.current = user?.uid || "";
    enabledRef.current = false;
    setEnabled(false);
    setNotice("");
  }, [user?.uid, admin]);
  useEffect(() => {
    const refresh = () => setPermission("Notification" in window ? Notification.permission : "unavailable");
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  useEffect(() => {
    setCount(0);
    if (!user || checking) return;
    let previous: number | undefined;
    return onSnapshot(doc(db, "supportSignals", admin ? "staff" : `user-${user.uid}`), (snapshot) => {
      const data = snapshot.data(), sequence = data?.sequence || 0;
      setCount(data?.unread || 0);
      if (previous !== undefined && sequence > previous && enabledRef.current && "Notification" in window && Notification.permission === "granted") {
        try {
          const alert = new Notification("ThrottleHub support", { body: "You have a support update. Sign in to view it." });
          alert.onclick = () => {
            window.focus();
            window.location.assign(`${admin ? "/admin/support" : "/help"}?ticket=${encodeURIComponent(data?.latestTicket || "")}`);
            alert.close();
          };
        } catch { setNotice("Browser alerts unavailable. Check your support inbox."); }
      }
      previous = sequence;
    }, () => { setCount(0); setNotice("Live support updates are unavailable. Open support to check for replies."); });
  }, [user, admin, checking]);
  async function toggle() {
    if (!user) return;
    if (enabledRef.current) { enabledRef.current = false; setEnabled(false); return; }
    if (!("Notification" in window)) { setNotice("This browser does not support notifications."); return; }
    const uid = user.uid;
    try {
      const result = await Notification.requestPermission();
      if (identity.current !== uid) return;
      setPermission(result);
      enabledRef.current = result === "granted";
      setEnabled(enabledRef.current);
      setNotice(result === "denied" ? "Notifications are blocked. Change this site's browser permission to enable them." : "");
    } catch { setNotice("Browser alerts unavailable."); }
  }
  return <Context.Provider value={{ admin: admin && !checking, count, enabled, permission, notice, toggle }}>{children}</Context.Provider>;
}
export function SupportBadge() {
  const { admin, count } = useContext(Context);
  return <span className="support-badge"><Link href="/help">Support{!admin && count > 0 && <span role="status" aria-label={`${count} unread support replies`}> ({count})</span>}</Link></span>;
}
function AlertSettings() {
  const { enabled, permission, notice, toggle } = useContext(Context);
  return <div className="support-alert-settings">
    <p>Foreground support alerts: <strong>{enabled && permission === "granted" ? "Enabled" : "Disabled"}</strong></p>
    <p>Browser permission: <strong>{permission === "denied" ? "Blocked" : permission === "default" ? "Not requested" : permission}</strong></p>
    <p>Alerts work only while this website tab is open. Closing or reloading the tab turns alerts off. Background push notifications are not enabled.</p>
    <button type="button" onClick={() => void toggle()} aria-pressed={enabled}>{enabled ? "Disable alerts" : "Enable alerts"}</button>
    {notice && <p role="status">{notice}</p>}
  </div>;
}
export function AdministratorTools() {
  const { admin, count } = useContext(Context);
  if (!admin) return null;
  return <section className="account-nav-section account-admin-tools" aria-labelledby="administrator-tools-title">
    <h2 id="administrator-tools-title"><ShieldCheck size={22} /> Administrator Tools</h2>
    <div className="account-nav-links">
      <Link href="/admin"><ShieldCheck size={19} /> Administrator Dashboard</Link>
      <Link href="/admin/support"><LifeBuoy size={19} /> Manage Support Tickets{count > 0 && <span aria-label={`${count} unread support tickets`} className="admin-support-count">{count}</span>}</Link>
      <Link href="/admin/payments"><CreditCard size={19} /> Payment Review</Link>
      <Link href="/admin/community"><ShieldCheck size={19} /> Moderation</Link>
    </div>
    <details id="support-notification-settings"><summary>Support Notification Settings</summary><AlertSettings /></details>
  </section>;
}
export function CustomerSupportSettings() {
  const { admin } = useContext(Context);
  if (admin) return null;
  return <details className="customer-support-settings"><summary>Support reply alerts</summary><AlertSettings /></details>;
}
