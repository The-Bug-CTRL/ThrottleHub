"use client";
import { LoadingState } from "@/components/ui/primitives";
import { confirmAction, requestText } from "@/components/ui/dialogs";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  writeBatch,
  updateDoc,
  setDoc,
  startAfter,
  serverTimestamp,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { StolenReport } from "@/lib/community-models";
import { moderateContent } from "@/lib/community";
import { dataError } from "@/lib/errors";
import { useRole } from "./use-role";
import { PrivateEvidence, PrivateTips } from "./stolen";
import { AdminNavigation } from "./admin-navigation";
type Flag = {
  id: string;
  targetId: string;
  replyId: string;
  reporterId: string;
  reason: string;
  status: string;
};
export function CommunityModeration() {
  const { moderator, user, checking } = useRole();
  const [section, setSection] = useState("stolenReports"),
    [records, setRecords] = useState<(StolenReport | Flag)[]>([]),
    [notice, setNotice] = useState(""),
    [cursor, setCursor] = useState<QueryDocumentSnapshot>(),
    [more, setMore] = useState(false);
  async function load(append = false) {
    try {
      const s = await getDocs(
        query(
          collection(db, section),
          orderBy("createdAt", "desc"),
          ...(append && cursor ? [startAfter(cursor)] : []),
          limit(20),
        ),
      );
      const next = s.docs.map(
        (d) => ({ ...d.data(), id: d.id }) as StolenReport | Flag,
      );
      setRecords((old) => (append ? [...old, ...next] : next));
      setCursor(s.docs.at(-1));
      setMore(s.size === 20);
    } catch (e) {
      setNotice(dataError(e));
    }
  }
  useEffect(() => {
    if (moderator) void load();
  }, [moderator, section]);
  if (checking)
    return (
      <section className="wrap section">
        <LoadingState label="Checking moderation access…" />
      </section>
    );
  if (!moderator || !user)
    return (
      <div className="auth-panel">
        <h1>Moderation access required.</h1>
        <p>A server-issued administrator or moderator claim is required.</p>
      </div>
    );
  async function resolve(flag: Flag, hide: boolean) {
    const batch = writeBatch(db);
    if (hide) {
      const target =
        section === "directoryFlags"
          ? doc(db, "directoryPosts", flag.targetId)
          : section === "reviewFlags"
            ? doc(db, "profiles", flag.targetId, "reviews", flag.replyId)
            : section === "forumReports"
              ? flag.replyId
                ? doc(
                    db,
                    "forumThreads",
                    flag.targetId,
                    "replies",
                    flag.replyId,
                  )
                : doc(db, "forumThreads", flag.targetId)
              : doc(db, "stolenReports", flag.targetId);
      batch.update(target, {
        status:
          section === "forumReports" || section === "reviewFlags"
            ? "hidden"
            : "archived",
        updatedAt: section === "reviewFlags" ? serverTimestamp() : Date.now(),
      });
    }
    batch.update(doc(db, section, flag.id), { status: "reviewed" });
    batch.set(doc(collection(db, "communityActions")), {
      actorId: user!.uid,
      targetCollection: section,
      targetId: flag.id,
      action: hide ? "hide-and-resolve" : "resolve",
      createdAt: Date.now(),
    });
    await batch.commit();
    await load();
  }
  return (
    <section className="wrap section">
      <div className="eyebrow">COMMUNITY MODERATION</div>
      <h1>Look after the riding community.</h1>
      <AdminNavigation />
      <div className="steps">
        {[
          ["stolenReports", "Stolen submissions"],
          ["forumReports", "Forum reports"],
          ["stolenFlags", "Disputed theft reports"],
          ["reviewFlags", "Member review reports"],
          ["directoryFlags", "Job & service reports"],
        ].map(([v, l]) => (
          <button
            className={section === v ? "active" : ""}
            onClick={() => setSection(v)}
            key={v}
          >
            {l}
          </button>
        ))}
      </div>
      <p className="notice">
        Review public descriptions and photographs for personal identifiers and
        unsupported accusations before approving. Publication does not claim
        independent verification. Private evidence must stay restricted.
      </p>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {records.length === 0 && <p>No records in this queue.</p>}
      {records.map((record) =>
        section === "stolenReports"
          ? (() => {
              const r = record as StolenReport;
              return (
                <article className="report" key={r.id}>
                  <span className="status-badge">{r.status}</span>
                  <h2>
                    {r.year} {r.make} {r.model}
                  </h2>
                  <p>
                    {r.city}, {r.country} · Stolen {r.stolenDate}
                  </p>
                  <p>
                    {r.colour} · {r.features}
                  </p>
                  <p className="description">{r.description}</p>
                  <div className="upload-previews">
                    {r.images.map((src) => (
                      <img
                        key={src}
                        src={src}
                        alt="Submitted motorcycle photograph"
                      />
                    ))}
                  </div>
                  <PrivateEvidence reportId={r.id} />
                  <PrivateTips reportId={r.id} />
                  <div className="manage-row">
                    {["published", "rejected", "archived", "recovered"].map(
                      (status) => (
                        <button
                          key={status}
                          onClick={async () => {
                            if (
                              !(await confirmAction(
                                `Change this report to ${status}?`,
                              ))
                            )
                              return;
                            try {
                              await moderateContent(
                                user,
                                "stolenReports",
                                r.id,
                                { status },
                                `stolen-${status}`,
                              );
                              setNotice(
                                "Status updated and audit action recorded.",
                              );
                              await load();
                            } catch (e) {
                              setNotice(dataError(e));
                            }
                          }}
                        >
                          {status === "published"
                            ? "Approve for publication"
                            : status}
                        </button>
                      ),
                    )}
                  </div>
                </article>
              );
            })()
          : (() => {
              const f = record as Flag;
              return (
                <article className="report" key={f.id}>
                  <h3>
                    {section === "forumReports"
                      ? "Forum concern"
                      : section === "directoryFlags"
                        ? "Job or service concern"
                        : section === "reviewFlags"
                          ? "Member review concern"
                          : "Disputed report"}
                  </h3>
                  <p>{f.reason}</p>
                  {section === "reviewFlags" && (
                    <Link href={`/seller/${f.targetId}#reviews`}>
                      Read the reported review on this profile &rarr;
                    </Link>
                  )}
                  <p>Status: {f.status}</p>
                  <Link
                    href={
                      section === "directoryFlags"
                        ? `/community-listings/${f.targetId}`
                        : section === "reviewFlags"
                          ? `/seller/${f.targetId}#reviews`
                          : section === "forumReports"
                            ? `/forum/${f.targetId}`
                            : `/stolen-bikes/${f.targetId}`
                    }
                  >
                    Review public content →
                  </Link>
                  <div className="manage-row">
                    <button
                      onClick={() =>
                        resolve(f, false).catch((e) => setNotice(dataError(e)))
                      }
                    >
                      Resolve without removal
                    </button>
                    <button
                      onClick={async () => {
                        if (
                          await confirmAction(
                            "Hide the reported content and resolve this concern?",
                          )
                        )
                          resolve(f, true).catch((e) =>
                            setNotice(dataError(e)),
                          );
                      }}
                    >
                      Hide / archive & resolve
                    </button>
                  </div>
                </article>
              );
            })(),
      )}
      {more && (
        <button onClick={() => load(true)}>Load more queue records</button>
      )}
      <section className="private-evidence" id="participant-controls">
        <h3>Restrict account participation</h3>
        <p>
          Restricts new topics, replies and edits. Only moderators can change
          these records. It does not disable the authentication identity.
        </p>
        <form
          className="inline-search"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget),
              uid = String(form.get("uid") || "").trim();
            if (
              !uid ||
              !(await confirmAction(
                "Restrict this account’s forum participation?",
              ))
            )
              return;
            try {
              await setDoc(doc(db, "restrictions", uid), {
                suspended: true,
                reason: String(form.get("reason")).slice(0, 500),
                actorId: user.uid,
                updatedAt: Date.now(),
              });
              setNotice("Forum participation restricted.");
            } catch (e) {
              setNotice(dataError(e));
            }
          }}
        >
          <input
            name="uid"
            aria-label="User UID to restrict"
            required
            placeholder="User UID"
          />
          <input
            name="reason"
            aria-label="Restriction reason"
            required
            maxLength={500}
            placeholder="Moderation reason"
          />
          <button>Restrict</button>
        </form>
        <button
          onClick={async () => {
            const uid = await requestText("User UID to restore");
            if (!uid) return;
            try {
              await updateDoc(doc(db, "restrictions", uid), {
                suspended: false,
                actorId: user.uid,
                updatedAt: Date.now(),
              });
              setNotice("Forum participation restored.");
            } catch (e) {
              setNotice(dataError(e));
            }
          }}
        >
          Restore participation
        </button>
      </section>
    </section>
  );
}
