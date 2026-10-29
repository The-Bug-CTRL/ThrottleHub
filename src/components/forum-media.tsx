"use client";
import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { ImagePlus, Video, Film, Link2, X, RotateCcw } from "lucide-react";
import { forumCategories } from "@/lib/community-models";
import {
  attachmentSchema,
  forumLimit,
  type ForumAttachment,
} from "@/lib/forum-media-model";
import { sharedVideo } from "@/lib/shared-video";
import { ContentText } from "./content-text";
const source = (id: string) => `/api/forum/media?id=${encodeURIComponent(id)}`;
export function ForumMedia({
  attachments = [],
}: {
  attachments?: ForumAttachment[];
}) {
  const [open, setOpen] = useState<string | null>(null),
    dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);
  return (
    <div className="forum-media-gallery">
      {attachments.map((a) =>
        a.kind === "photo" ? (
          <button
            type="button"
            className="forum-photo"
            key={a.id}
            onClick={() => setOpen(source(a.id))}
          >
            <img
              src={source(a.id)}
              loading="lazy"
              alt="Photo shared by a rider; open full size"
            />
          </button>
        ) : (
          <ClickMedia key={a.id} kind={a.kind} url={source(a.id)} />
        ),
      )}
      {open && (
        <dialog
          ref={dialog}
          className="forum-lightbox"
          onClose={() => setOpen(null)}
          onClick={(e) => {
            if (e.target === e.currentTarget) dialog.current?.close();
          }}
        >
          <button
            type="button"
            autoFocus
            onClick={() => dialog.current?.close()}
            aria-label="Close photo"
          >
            <X />
          </button>
          <img src={open} alt="Enlarged rider photo" />
        </dialog>
      )}
    </div>
  );
}
function ClickMedia({ kind, url }: { kind: string; url: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="forum-motion">
      {playing ? (
        kind === "video" ? (
          <video src={url} controls playsInline preload="none" />
        ) : (
          <>
            <img src={url} alt="Rider's animation" />
            <button type="button" onClick={() => setPlaying(false)}>
              Stop animation
            </button>
          </>
        )
      ) : (
        <button type="button" onClick={() => setPlaying(true)}>
          {kind === "video" ? <Video /> : <Film />}{" "}
          {kind === "video" ? "Load video" : "Play GIF"}
        </button>
      )}
    </div>
  );
}
type Row = {
  key: string;
  kind: ForumAttachment["kind"];
  id?: string;
  file?: File;
  preview?: string;
  state: "queued" | "uploading" | "processing" | "ready" | "failed";
  progress: number;
  error?: string;
  existing?: boolean;
};
export function ForumComposer({
  user,
  threadId,
  replyId,
  mode = "create",
  initialBody = "",
  initialAttachments = [],
  onSaved,
  onCancel,
}: {
  user: User;
  threadId: string;
  replyId?: string;
  mode?: "create" | "edit";
  initialBody?: string;
  initialAttachments?: ForumAttachment[];
  onSaved: (value: {
    id: string;
    body: string;
    attachments: ForumAttachment[];
  }) => void;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState(initialBody),
    [rows, setRows] = useState<Row[]>(
      initialAttachments.map((a) => ({
        ...a,
        key: a.id,
        state: "ready",
        progress: 100,
        existing: true,
      })),
    ),
    [links, setLinks] = useState<string[]>([]),
    [link, setLink] = useState(""),
    [linkOpen, setLinkOpen] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const cancelled = useRef(new Set<string>()),
    queue = useRef(Promise.resolve());
  const requests = useRef(new Map<string, XMLHttpRequest>()),
    previews = useRef(new Set<string>()),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const active = requests.current,
      urls = previews.current;
    return () => {
      alive.current = false;
      active.forEach((x) => x.abort());
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  const update = (key: string, changes: Partial<Row>) => {
    if (alive.current)
      setRows((old) =>
        old.map((r) => (r.key === key ? { ...r, ...changes } : r)),
      );
  };
  async function api(url: string, data?: unknown, method = "POST") {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${await user.getIdToken()}`,
        "Content-Type": "application/json",
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || "Request failed.");
    return result;
  }
  async function upload(row: Row) {
    if (!row.file || cancelled.current.has(row.key) || !alive.current) return;
    update(row.key, { state: "uploading", progress: 0, error: "" });
    let id = "";
    try {
      if (row.id && !row.existing)
        await api(source(row.id), undefined, "DELETE").catch(() => {});
      const slot = await api("/api/forum/media", {
        target: { threadId, ...(replyId ? { replyId } : {}) },
        kind: row.kind,
      });
      id = slot.id;
      if (!alive.current || cancelled.current.has(row.key)) {
        void api(source(id), undefined, "DELETE").catch(() => {});
        return;
      }
      update(row.key, { id });
      const token = await user.getIdToken();
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        requests.current.set(row.key, xhr);
        xhr.open("PUT", source(id));
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.timeout = 300000;
        xhr.upload.onprogress = (e) =>
          update(row.key, {
            progress: e.lengthComputable
              ? Math.round((e.loaded / e.total) * 100)
              : 0,
          });
        xhr.upload.onload = () =>
          update(row.key, { state: "processing", progress: 100 });
        xhr.onerror = () =>
          reject(Error("Upload interrupted. Check your connection and retry."));
        xhr.ontimeout = () =>
          reject(Error("Processing timed out. Retry with a smaller file."));
        xhr.onabort = () => reject(Error("Upload cancelled."));
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else {
            let message = "Upload failed. Retry.";
            try {
              message = JSON.parse(xhr.responseText).error || message;
            } catch {}
            reject(Error(message));
          }
        };
        xhr.send(row.file);
      });
      update(row.key, { id, state: "ready", progress: 100 });
    } catch (e) {
      update(row.key, {
        state: "failed",
        error: e instanceof Error ? e.message : "Upload failed.",
      });
    } finally {
      requests.current.delete(row.key);
    }
  }
  function remove(row: Row) {
    cancelled.current.add(row.key);
    requests.current.get(row.key)?.abort();
    setRows((old) => old.filter((r) => r.key !== row.key));
    if (row.preview) {
      URL.revokeObjectURL(row.preview);
      previews.current.delete(row.preview);
    }
    if (row.id && !row.existing)
      void api(source(row.id), undefined, "DELETE").catch(() => {}); // Processing/crash orphans are swept by maintenance.
  }
  function pick(files: FileList | null, kind: Row["kind"]) {
    if (!files) return;
    try {
      const additions = Array.from(files).map((file) => ({
        key: crypto.randomUUID(),
        kind,
        file,
        state: "queued" as const,
        progress: 0,
      }));
      attachmentSchema.parse([
        ...rows.map((r) => ({ id: r.key, kind: r.kind })),
        ...additions.map((r) => ({ id: r.key, kind: r.kind })),
      ]);
      if (additions.some((r) => r.file.size > forumLimit(kind)))
        throw Error(
          `Use ${kind === "video" ? "videos under 50" : "images under 5"} MiB.`,
        );
      const prepared = additions.map((r) => {
        const preview = URL.createObjectURL(r.file);
        previews.current.add(preview);
        return { ...r, preview };
      });
      setRows((old) => [...old, ...prepared]);
      setError("");
      prepared.forEach((r) => {
        queue.current = queue.current.then(() => upload(r));
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check attachment limits.");
    }
  }
  return (
    <form
      className="forum-composer"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const form = new FormData(e.currentTarget),
          text = [body.trim(), ...links].filter(Boolean).join("\n\n");
        try {
          if (rows.some((r) => r.state !== "ready" || !r.id))
            throw Error("Wait for uploads, or remove/retry failed files.");
          const attachments = rows.map((r) => ({ id: r.id!, kind: r.kind }));
          const result = await api("/api/forum/posts", {
            target: { threadId, ...(replyId ? { replyId } : {}) },
            mode,
            body: text,
            attachments,
            ...(!replyId && mode === "create"
              ? { title: form.get("title"), category: form.get("category") }
              : {}),
          });
          onSaved({ id: result.id, body: text, attachments });
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not save post.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        {!replyId && mode === "create" && (
          <>
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
          </>
        )}
        <label>
          {mode === "edit"
            ? "Edit your post"
            : replyId
              ? "Join the discussion"
              : "Your discussion"}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={replyId ? 5 : 8}
            required
            minLength={!replyId && mode === "create" ? 20 : 2}
            maxLength={replyId ? 6000 : 12000}
          />
        </label>
        <div className="forum-media-toolbar">
          {(
            [
              {
                kind: "photo",
                label: "Add Photos",
                accept: "image/jpeg,image/png,image/webp",
                Icon: ImagePlus,
              },
              {
                kind: "video",
                label: "Add Video",
                accept: "video/mp4",
                Icon: Video,
              },
              {
                kind: "gif",
                label: "Add GIF",
                accept: "image/gif",
                Icon: Film,
              },
            ] as const
          ).map(({ kind, label, accept, Icon }) => (
            <label className="forum-file-button" key={kind}>
              <Icon size={18} />
              {label}
              <input
                type="file"
                aria-label={label}
                accept={accept}
                multiple={kind === "photo"}
                onChange={(e) => {
                  pick(e.target.files, kind);
                  e.target.value = "";
                }}
              />
            </label>
          ))}
          <button className="button forum-file-button" type="button" onClick={() => setLinkOpen(!linkOpen)}>
            <Link2 size={18} /> Attach Link
          </button>
        </div>
        <small>
          Up to 5 photos (5 MiB each), 1 MP4 video (50 MiB, 60 seconds, 1080p
          H.264/AAC) and 1 GIF (5 MiB, 10 seconds). Export HEIC/HEVC phone files
          to JPEG/MP4 first.
        </small>
        {linkOpen && (
          <div className="forum-link-input">
            <label>
              YouTube URL
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=�"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                const safe = sharedVideo(link.trim());
                if (safe?.provider !== "YouTube" || links.length >= 3) {
                  setError(
                    "Use a valid HTTPS YouTube link; up to 3 attached links.",
                  );
                  return;
                }
                setLinks([...links, safe.url]);
                setLink("");
                setLinkOpen(false);
                setError("");
              }}
            >
              Attach video link
            </button>
          </div>
        )}
        <div className="forum-upload-previews">
          {rows.map((row) => (
            <article key={row.key}>
              {row.preview ? (
                row.kind === "photo" ? (
                  <img src={row.preview} alt="Selected photo" />
                ) : (
                  <ClickMedia kind={row.kind} url={row.preview} />
                )
              ) : (
                <ForumMedia attachments={[{ id: row.id!, kind: row.kind }]} />
              )}
              <span>{row.file?.name || row.kind}</span>
              <small role="status">
                {row.state === "queued"
                  ? "Waiting to upload"
                  : row.state === "processing"
                    ? "Validating and processing�"
                    : row.state === "ready"
                      ? "Ready to post"
                      : row.state === "failed"
                        ? row.error
                        : `Uploading ${row.progress}%`}
              </small>
              {(row.state === "uploading" || row.state === "processing") && (
                <progress
                  max={100}
                  value={row.progress}
                  aria-label="Upload progress"
                />
              )}
              {row.state === "failed" && (
                <button type="button" onClick={() => void upload(row)}>
                  <RotateCcw size={16} /> Retry
                </button>
              )}
              <button type="button" onClick={() => remove(row)}>
                <X size={16} />{" "}
                {row.state === "uploading" ? "Cancel" : "Remove"}
              </button>
            </article>
          ))}
        </div>
        {links.map((url, index) => (
          <div key={url + index}>
            <ContentText text={url} />
            <button
              type="button"
              onClick={() =>
                setLinks((old) => old.filter((_, i) => i !== index))
              }
            >
              Remove link
            </button>
          </div>
        ))}
        <p className="muted">
          Share your own media. Keep private details out of photos and videos.
          Report inappropriate posts to the moderation team.
        </p>
        <div className="manage-row">
          <button
            className="button"
            disabled={busy || rows.some((r) => r.state !== "ready")}
          >
            {busy
              ? "Saving�"
              : mode === "edit"
                ? "Save changes"
                : replyId
                  ? "Post reply"
                  : "Publish discussion"}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel}>
              Cancel editing
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
      </fieldset>
    </form>
  );
}
