"use client";
import { confirmAction } from "@/components/ui/dialogs";

import Link from "next/link";
import { categoryById, categoryHref } from "@/lib/taxonomy";
import { Listing } from "@/lib/models";
import { AdminNavigation } from "@/components/admin-navigation";
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  getDoc,
  query,
  limit,
  doc,
  writeBatch,
} from "firebase/firestore";
import { useSession } from "@/components/session";
import { db } from "@/lib/firebase";
import { changeListing } from "@/lib/listing-client";
type Report = { id: string; listingId: string; reason: string; status: string };
export default function Admin() {
  const { user } = useSession();
  const [allowed, setAllowed] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [reportedListings, setReportedListings] = useState<
    Record<string, Listing>
  >({});
  const [notice, setNotice] = useState("");
  const [listingId, setListingId] = useState("");
  useEffect(() => {
    let active = true;
    setAllowed(false);
    setReports([]);
    if (user)
      user
        .getIdTokenResult(true)
        .then(async (token) => {
          if (!active) return;
          if (token.claims.admin !== true) return;
          setAllowed(true);
          const s = await getDocs(
            query(collection(db, "listingReports"), limit(40)),
          );
          const loaded = await Promise.all(
            s.docs.map(async (report) => {
              const id = report.data().listingId;
              const l = await getDoc(doc(db, "listings", id));
              return l.exists() ? ([id, { ...l.data(), id }] as const) : null;
            }),
          );
          if (active)
            setReportedListings(
              Object.fromEntries(
                loaded.filter((v): v is NonNullable<typeof v> => v !== null),
              ) as Record<string, Listing>,
            );
          if (active)
            setReports(
              s.docs.map((d) => ({ ...d.data(), id: d.id }) as Report),
            );
        })
        .catch(() => setNotice("Unable to load moderation."));
    return () => {
      active = false;
    };
  }, [user]);
  return (
    <section className="wrap section">
      <div className="eyebrow">MODERATION</div>
      <h1>Keep the community riding.</h1>
      <AdminNavigation />
      {!allowed || !user ? (
        <p>
          Access requires a server-issued administrator claim. No public
          self-promotion is available.
        </p>
      ) : (
        <>
          <div className="profile-form">
            <h2>Listing privacy and removal</h2>
            <label>
              Listing ID
              <input
                value={listingId}
                onChange={(e) => setListingId(e.target.value)}
                maxLength={128}
              />
            </label>
            <p>
              De-identify preserves basic historical item details but removes
              the seller link, free text and photos. Remove deletes public
              content and photos. Review every advert before deleting a seller
              account.
            </p>
            {(
              [
                ["anonymise", "De-identify historical advert"],
                ["removed", "Remove advert and photos"],
                ["cleanup", "Retry media cleanup"],
              ] as const
            ).map(([action, label]) => (
              <button
                key={action}
                disabled={!listingId}
                onClick={async () => {
                  if (
                    !(await confirmAction(
                      `${label} for ${listingId}? This cannot be undone.`,
                    ))
                  )
                    return;
                  try {
                    const result = await changeListing(
                      user,
                      listingId,
                      action === "removed"
                        ? { action: "status", status: "removed" }
                        : { action },
                    );
                    setNotice(result.warning || "Listing request completed.");
                  } catch (error) {
                    setNotice(
                      error instanceof Error
                        ? error.message
                        : "Listing request failed.",
                    );
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {reports.map((r) => (
            <article className="report" key={r.id}>
              <h3>{reportedListings[r.listingId]?.title || r.listingId}</h3>
              {reportedListings[r.listingId]?.categoryId && (
                <Link
                  href={categoryHref(reportedListings[r.listingId].categoryId)}
                >
                  {categoryById[reportedListings[r.listingId].categoryId]?.name}
                </Link>
              )}
              <p>{r.reason}</p>
              <small>{r.status}</small>
              <button
                className="button"
                onClick={async () => {
                  if (
                    !(await confirmAction(
                      "Hide this listing and record the moderation action?",
                    ))
                  )
                    return;
                  try {
                    const batch = writeBatch(db);
                    const result = await changeListing(user, r.listingId, {
                      action: "status",
                      status: "hidden",
                    });
                    batch.update(doc(db, "listingReports", r.id), {
                      status: "reviewed",
                    });
                    batch.set(doc(collection(db, "moderationActions")), {
                      adminId: user!.uid,
                      listingId: r.listingId,
                      reportId: r.id,
                      action: "hide",
                      createdAt: Date.now(),
                    });
                    await batch.commit();
                    setNotice(
                      result.warning ||
                        "Listing hidden; audit action recorded.",
                    );
                  } catch {
                    setNotice("Moderation failed.");
                  }
                }}
              >
                Hide listing & resolve
              </button>
            </article>
          ))}
          {!reports.length && <p>No reports to review.</p>}
        </>
      )}
      {notice && <p className="notice">{notice}</p>}
    </section>
  );
}
