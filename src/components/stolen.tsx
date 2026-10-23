"use client";
import { RoostLoader } from "@/components/loading/roost-loader";
import { LoadingState } from "@/components/ui/primitives";
import { provinces, provinceCode } from "@/lib/marketplace";
import { confirmAction } from "@/components/ui/dialogs";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  updateDoc,
  writeBatch,
  addDoc,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { ref, uploadBytes, getBlob } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { brand, makes } from "@/lib/config";
import {
  StolenReport,
  stolenSchema,
  evidenceSchema,
} from "@/lib/community-models";
import { dataError } from "@/lib/errors";
import { tokens } from "@/lib/models";
import { reportContent } from "@/lib/community";
import { useSession } from "./session";
import { usePageQuery } from "./use-page-query";
import { Empty } from "./empty";
import { ContentText } from "./content-text";
import { ImageUpload } from "./image-upload";
export function StolenDirectory() {
  const [fields, setFields] = useState<Record<string, string>>({}),
    [applied, setApplied] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("all");
  const feed = usePageQuery<StolenReport>(
    "stolenReports",
    applied,
    "createdAt",
    "desc",
    12,
    status === "all" ? ["published", "recovered"] : [status],
  );
  return (
    <section className="wrap section">
      <div className="section-heading">
        <div className="eyebrow">COMMUNITY AWARENESS</div>
        <h1>Help a bike find its way home.</h1>
        <Link className="button" href="/stolen-bikes/report">
          Report a stolen motorcycle
        </Link>
      </div>
      <p>
        Reports are user-submitted and reviewed for publication. Publication is
        not independent verification of a theft or ownership claim.
      </p>
      <p className="notice">
        Share information responsibly. Do not confront anyone, publish
        accusations or disclose private identifiers. Pass urgent information to
        the relevant authorities.
      </p>
      <form
        className="stolen-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(fields);
        }}
      >
        <label>
          Make
          <select
            value={fields.make || ""}
            onChange={(e) => setFields((f) => ({ ...f, make: e.target.value }))}
          >
            <option value="">All makes</option>
            {makes.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        {[
          ["model", "Model"],
          ["year", "Year"],
          ["region", "Province"],
          ["city", "City / general area"],
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            {key === "region" ? (
              <select
                value={fields.region || ""}
                onChange={(e) =>
                  setFields((f) => ({ ...f, region: e.target.value }))
                }
              >
                <option value="">All provinces</option>
                {Object.entries(provinces).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={key === "year" ? "number" : "text"}
                min={key === "year" ? 1950 : undefined}
                max={key === "year" ? 2028 : undefined}
                value={fields[key] || ""}
                onChange={(e) =>
                  setFields((f) => ({ ...f, [key]: e.target.value }))
                }
              />
            )}
          </label>
        ))}
        <label>
          Country
          <select
            value="ZA"
            onChange={(e) =>
              setFields((f) => ({ ...f, country: e.target.value }))
            }
          >
            <option value="ZA">South Africa</option>
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
          Reported since
          <input
            type="date"
            onChange={(e) =>
              setFields((f) => ({
                ...f,
                _createdAfter: e.target.value
                  ? String(Date.parse(e.target.value))
                  : "",
              }))
            }
          />
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Reported stolen & recovered</option>
            <option value="published">Reported stolen</option>
            <option value="recovered">Recovered</option>
          </select>
        </label>
        <button className="button">Apply filters</button>
      </form>
      {feed.error && (
        <p role="alert" className="notice error">
          {feed.error}
        </p>
      )}
      {feed.busy && <LoadingState label="Loading reports…" />}
      <div className="article-grid">
        {feed.items.map((r) => (
          <StolenCard key={r.id} report={r} />
        ))}
      </div>
      {!feed.busy && !feed.error && !feed.items.length && (
        <Empty
          title="No reports in this view."
          description="No approved user reports match your filters. You can submit a stolen-motorcycle report for moderation."
          href="/stolen-bikes/report"
          label="Submit a report"
        />
      )}
      {feed.more && (
        <button onClick={feed.loadMore} disabled={feed.busy}>
          Load more reports
        </button>
      )}
      <MyStolenReports />
    </section>
  );
}
export function StolenCard({ report: r }: { report: StolenReport }) {
  return (
    <article className="stolen-card">
      <Link href={`/stolen-bikes/${r.id}`}>
        <img
          src={r.images[0] || "/no-photo.svg"}
          alt={`${r.make} ${r.model}`}
        />
        <div>
          <span
            className={`status-badge ${r.status === "recovered" ? "recovered" : ""}`}
          >
            {r.status === "recovered"
              ? "Recovered"
              : "User report · Reported stolen"}
          </span>
          <h2>
            {r.year} {r.make} {r.model}
          </h2>
          <p>
            {r.city}, {r.country} · {r.colour}
          </p>
          <small>
            Stolen {r.stolenDate} · Reported{" "}
            {new Date(r.createdAt).toLocaleDateString("en-ZA")}
          </small>
        </div>
      </Link>
    </article>
  );
}
export function StolenForm() {
  const { user, loading } = useSession();
  const params = useSearchParams(),
    router = useRouter();
  const edit = params.get("edit");
  const [id, setId] = useState(""),
    [entry, setEntry] = useState<Partial<StolenReport>>({}),
    [images, setImages] = useState<string[]>([]),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [evidence, setEvidence] = useState<
    ReturnType<typeof evidenceSchema.parse>
  >({ policeCase: "", frameId: "", engineId: "", note: "", paths: [] });
  useEffect(() => {
    setId(edit || doc(collection(db, "stolenReports")).id);
    if (edit && user) {
      getDoc(doc(db, "stolenReports", edit))
        .then((d) => {
          if (!d.exists() || d.data().ownerId !== user.uid)
            throw new Error("This report is unavailable or not yours.");
          if (!["pending", "rejected"].includes(d.data().status))
            throw new Error(
              "Published reports must be archived or marked recovered; content changes need moderator review.",
            );
          setEntry({ ...d.data(), id: d.id } as StolenReport);
          setImages(d.data().images || []);
        })
        .catch((e) => setNotice(dataError(e)));
      getDoc(doc(db, "stolenReports", edit, "private", "evidence"))
        .then((d) => {
          if (d.exists()) setEvidence(d.data() as typeof evidence);
        })
        .catch(() => {});
    }
  }, [edit, user]);
  if (loading)
    return (
      <section className="wrap section">
        <LoadingState label="Loading account…" />
      </section>
    );
  if (!user)
    return (
      <div className="auth-panel">
        <h1>Report a stolen motorcycle.</h1>
        <p>
          Your account lets you manage the report and receive private
          information from the community.
        </p>
        <Link className="button" href="/auth">
          Sign in to submit a report
        </Link>
      </div>
    );
  return (
    <section className="form-panel">
      <div className="eyebrow">STOLEN MOTORCYCLE REPORT</div>
      <h1>Help the community recognise your bike.</h1>
      <p className="notice">
        Use general location and motorcycle details only. Do not name suspects,
        publish exact home addresses or place case references or full
        frame/engine numbers in public fields. New and edited submissions
        require moderator review.
      </p>
      <form
        key={entry.id || id}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const data = stolenSchema.parse(
              Object.fromEntries(new FormData(e.currentTarget)),
            );
            const priv = evidenceSchema.parse(evidence);
            const target = doc(db, "stolenReports", id);
            const old = edit ? await getDoc(target) : null;
            const now = Date.now();
            const batch = writeBatch(db);
            batch.set(target, {
              ...data,
              ownerId: user.uid,
              images,
              status: "pending",
              createdAt: old?.data()?.createdAt || now,
              updatedAt: now,
              searchTokens: tokens(
                `${data.make} ${data.model} ${data.colour} ${data.features}`,
              ),
            });
            batch.set(doc(db, "stolenReports", id, "private", "evidence"), {
              ...priv,
              ownerId: user.uid,
            });
            await batch.commit();
            router.push("/stolen-bikes?submitted=1");
          } catch (error) {
            setNotice(dataError(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="field-row">
          <label>
            Manufacturer
            <input
              name="make"
              required
              maxLength={40}
              defaultValue={entry.make}
            />
          </label>
          <label>
            Model
            <input
              name="model"
              required
              maxLength={80}
              defaultValue={entry.model}
            />
          </label>
          <label>
            Model year
            <input
              type="number"
              name="year"
              min={1950}
              max={2028}
              required
              defaultValue={entry.year}
            />
          </label>
        </div>
        <label>
          Main colour
          <input
            name="colour"
            maxLength={60}
            required
            defaultValue={entry.colour}
          />
        </label>
        <label>
          Distinguishing features (public)
          <textarea
            name="features"
            maxLength={1500}
            defaultValue={entry.features}
          />
        </label>
        <label>
          Approximate theft date
          <input
            name="stolenDate"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            required
            defaultValue={entry.stolenDate}
          />
        </label>
        <div className="field-row">
          <label>
            Country
            <select name="country" defaultValue={entry.country || "ZA"}>
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
              defaultValue={provinceCode(entry.region || "")}
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
            City / general area
            <input
              name="city"
              required
              maxLength={80}
              defaultValue={entry.city}
            />
          </label>
        </div>
        <label>
          General incident description (public)
          <textarea
            name="description"
            required
            minLength={20}
            maxLength={3000}
            rows={5}
            defaultValue={entry.description}
          />
        </label>
        <ImageUpload
          path={`stolen-images/${user.uid}/${id}`}
          images={images}
          onChange={setImages}
        />
        <fieldset className="private-evidence">
          <legend>Private information — owner and moderators only</legend>
          <p>
            These fields and documents are kept in restricted records. They
            never appear on the public report page.
          </p>
          {[
            ["policeCase", "Police case reference"],
            ["frameId", "Full frame / VIN identifier"],
            ["engineId", "Engine identifier"],
            ["note", "Private note for moderators"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                maxLength={key === "note" ? 1500 : 120}
                value={evidence[key as "policeCase"] || ""}
                onChange={(e) =>
                  setEvidence((v) => ({ ...v, [key]: e.target.value }))
                }
              />
            </label>
          ))}
          <label>
            Optional ownership evidence (up to 4 · JPEG/PNG/PDF · 5 MB per file)
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              multiple
              disabled={busy}
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                if (evidence.paths.length + files.length > 4) {
                  setNotice("Maximum four evidence files.");
                  return;
                }
                setBusy(true);
                try {
                  const paths: string[] = [];
                  for (const f of files) {
                    if (
                      f.size > 5 * 1024 * 1024 ||
                      !["image/jpeg", "image/png", "application/pdf"].includes(
                        f.type,
                      )
                    )
                      throw new Error(
                        "Evidence must be JPEG, PNG or PDF under 5 MB.",
                      );
                    const path = `stolen-evidence/${user.uid}/${id}/${crypto.randomUUID()}`;
                    await uploadBytes(ref(storage, path), f, {
                      contentType: f.type,
                    });
                    paths.push(path);
                  }
                  setEvidence((old) => ({
                    ...old,
                    paths: [...old.paths, ...paths],
                  }));
                  setNotice(
                    "Private evidence uploaded. Submit the report to save its references.",
                  );
                } catch (error) {
                  setNotice(dataError(error));
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
          <small>
            {evidence.paths.length} private file references saved in this form.
            No public download links are generated.
          </small>
        </fieldset>
        <label className="check-label">
          <input type="checkbox" required />I am authorised to report this
          motorcycle and have kept personal identifiers out of the public
          fields.
        </label>
        <button className="button" disabled={busy}>
          {busy && (
            <RoostLoader
              size={40}
              label="Submitting report or uploading evidence"
            />
          )}{" "}
          Submit for review
        </button>
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
      </form>
    </section>
  );
}
export function StolenDetail({ report: initial }: { report: StolenReport }) {
  const [report, setReport] = useState(initial),
    [notice, setNotice] = useState(""),
    [tip, setTip] = useState("");
  const { user } = useSession();
  const owner = user?.uid === report.ownerId;
  return (
    <article className="reading-panel">
      <Link href="/stolen-bikes">← Stolen-bike directory</Link>
      <span
        className={`status-badge ${report.status === "recovered" ? "recovered" : ""}`}
      >
        {report.status === "recovered"
          ? "Recovered"
          : "Reported stolen · User-submitted"}
      </span>
      <h1>
        {report.year} {report.make} {report.model}
      </h1>
      <p>
        {report.colour} · {report.city},{" "}
        {provinces[report.region as keyof typeof provinces] || report.region},{" "}
        {report.country}
      </p>
      <p>
        Approximate theft date: {report.stolenDate} · Report published from
        submission {new Date(report.createdAt).toLocaleDateString("en-ZA")}
      </p>
      <div className="report-gallery">
        {report.images.length ? (
          report.images.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={`Reported motorcycle photo ${i + 1}`}
            />
          ))
        ) : (
          <img src="/no-photo.svg" alt="No motorcycle photograph available" />
        )}
      </div>
      <h2>Distinguishing features</h2>
      <ContentText text={report.features || "Not provided."} />
      <h2>Submitted account</h2>
      <ContentText text={report.description} />
      <p className="notice">
        This is a user-submitted report reviewed for publication, not
        independently verified theft information. Do not confront anyone or
        publish accusations. Send useful information privately and contact the
        relevant authorities.
      </p>
      {owner && (
        <div className="manage-row">
          {report.status === "published" && (
            <button
              onClick={async () => {
                if (!(await confirmAction("Mark your motorcycle recovered?")))
                  return;
                try {
                  await updateDoc(doc(db, "stolenReports", report.id), {
                    status: "recovered",
                    updatedAt: Date.now(),
                  });
                  setReport({ ...report, status: "recovered" });
                  setNotice("Recovery status updated.");
                } catch (e) {
                  setNotice(dataError(e));
                }
              }}
            >
              Mark recovered
            </button>
          )}
          <button
            onClick={async () => {
              if (
                !(await confirmAction(
                  "Archive this report from the public directory?",
                ))
              )
                return;
              try {
                await updateDoc(doc(db, "stolenReports", report.id), {
                  status: "archived",
                  updatedAt: Date.now(),
                });
                location.href = "/stolen-bikes";
              } catch (e) {
                setNotice(dataError(e));
              }
            }}
          >
            Archive report
          </button>
        </div>
      )}
      {user && !owner && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await addDoc(collection(db, "stolenReports", report.id, "tips"), {
                senderId: user.uid,
                text: tip.trim(),
                createdAt: Date.now(),
              });
              setTip("");
              setNotice(
                "Information sent privately to the report owner and moderators.",
              );
            } catch (error) {
              setNotice(dataError(error));
            }
          }}
        >
          <label>
            Send information privately
            <textarea
              required
              minLength={10}
              maxLength={2000}
              value={tip}
              onChange={(e) => setTip(e.target.value)}
            />
          </label>
          <button className="button">Send information</button>
        </form>
      )}
      {!user && (
        <Link className="button" href="/auth">
          Sign in to send information
        </Link>
      )}
      {user && (
        <button
          className="text-button"
          onClick={() =>
            reportContent(user, "stolen", report.id)
              .then(() =>
                setNotice(
                  "If submitted, the concern is available to moderators.",
                ),
              )
              .catch((e) => setNotice(dataError(e)))
          }
        >
          Flag inaccurate or malicious report
        </button>
      )}
      {owner && (
        <>
          <PrivateEvidence reportId={report.id} />
          <PrivateTips reportId={report.id} />
        </>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
    </article>
  );
}
export function MyStolenReports() {
  const { user } = useSession();
  const [reports, setReports] = useState<StolenReport[]>([]),
    [error, setError] = useState(""),
    [cursor, setCursor] = useState<QueryDocumentSnapshot>(),
    [more, setMore] = useState(false);
  async function load(append = false) {
    if (!user) return;
    try {
      const constraints = [
        where("ownerId", "==", user.uid),
        orderBy("createdAt", "desc"),
        ...(append && cursor ? [startAfter(cursor)] : []),
        limit(12),
      ];
      const s = await getDocs(
        query(collection(db, "stolenReports"), ...constraints),
      );
      setReports((old) =>
        append
          ? [
              ...old,
              ...s.docs.map((d) => ({ ...d.data(), id: d.id }) as StolenReport),
            ]
          : s.docs.map((d) => ({ ...d.data(), id: d.id }) as StolenReport),
      );
      setCursor(s.docs.at(-1));
      setMore(s.size === 12);
    } catch (e) {
      setError(dataError(e));
    }
  }
  useEffect(() => {
    if (user) void load();
    else setReports([]);
  }, [user]);
  if (!user) return null;
  return (
    <div className="section">
      <h2>Your submitted reports.</h2>
      {error && <p className="notice error">{error}</p>}
      {reports.length === 0 && !error && (
        <p>No reports submitted by your account.</p>
      )}
      {reports.map((r) => (
        <div className="topic-row" key={r.id}>
          <h3>
            {r.make} {r.model}
          </h3>
          <span>{r.status}</span>
          <div className="manage-row">
            {["pending", "rejected"].includes(r.status) ? (
              <Link href={`/stolen-bikes/report?edit=${r.id}`}>
                Edit and resubmit
              </Link>
            ) : (
              ["published", "recovered"].includes(r.status) && (
                <Link href={`/stolen-bikes/${r.id}`}>
                  View / manage public report
                </Link>
              )
            )}
            <button
              onClick={async () => {
                if (!(await confirmAction("Archive your report?"))) return;
                try {
                  await updateDoc(doc(db, "stolenReports", r.id), {
                    status: "archived",
                    updatedAt: Date.now(),
                  });
                  await load();
                } catch (e) {
                  setError(dataError(e));
                }
              }}
            >
              Archive
            </button>
          </div>
          <PrivateTips reportId={r.id} />
        </div>
      ))}
      {more && (
        <button onClick={() => load(true)}>Load more of your reports</button>
      )}
    </div>
  );
}
export function PrivateEvidence({ reportId }: { reportId: string }) {
  const [evidence, setEvidence] = useState<Record<string, unknown>>(),
    [error, setError] = useState("");
  return (
    <div className="private-evidence">
      <button
        onClick={async () => {
          try {
            const d = await getDoc(
              doc(db, "stolenReports", reportId, "private", "evidence"),
            );
            setEvidence(d.data() || {});
            setError("");
          } catch (e) {
            setError(dataError(e));
          }
        }}
      >
        View restricted evidence
      </button>
      {error && <p className="notice error">{error}</p>}
      {evidence && (
        <>
          <dl>
            {["policeCase", "frameId", "engineId", "note"].map((key) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{String(evidence[key] || "Not supplied")}</dd>
              </div>
            ))}
          </dl>
          {((evidence.paths || []) as string[]).map((path, i) => (
            <button
              key={path}
              onClick={async () => {
                try {
                  const blob = await getBlob(ref(storage, path));
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `private-evidence-${i + 1}`;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 10000);
                } catch (e) {
                  setError(dataError(e));
                }
              }}
            >
              Download restricted file {i + 1}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
export function PrivateTips({ reportId }: { reportId: string }) {
  const [tips, setTips] = useState<
      { id: string; text: string; createdAt: number }[]
    >([]),
    [error, setError] = useState("");
  return (
    <details className="private-tips">
      <summary
        onClick={async () => {
          try {
            const s = await getDocs(
              query(
                collection(db, "stolenReports", reportId, "tips"),
                orderBy("createdAt", "desc"),
                limit(20),
              ),
            );
            setTips(
              s.docs.map(
                (d) => ({ ...d.data(), id: d.id }) as (typeof tips)[number],
              ),
            );
          } catch (e) {
            setError(dataError(e));
          }
        }}
      >
        Private information received (latest 20)
      </summary>
      {error && <p className="notice error">{error}</p>}
      {tips.map((t) => (
        <div className="forum-reply" key={t.id}>
          <small>{new Date(t.createdAt).toLocaleString("en-ZA")}</small>
          <ContentText text={t.text} />
        </div>
      ))}
      {!error && !tips.length && <p>No information received.</p>}
    </details>
  );
}
