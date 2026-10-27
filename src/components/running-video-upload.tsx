"use client";
import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { uploadBytesResumable, ref, getBlob } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { MAX_VIDEO_BYTES, type RunningVideo } from "@/lib/running-video";
export function RunningVideoUpload({
  user,
  listingId,
  value,
  onChange,
  onBusy,
  petrolRequired = false,
}: {
  user: User;
  listingId: string;
  value: RunningVideo | null;
  onChange: (v: RunningVideo | null) => void;
  onBusy: (b: boolean) => void;
  petrolRequired?: boolean;
}) {
  const task = useRef<ReturnType<typeof uploadBytesResumable> | null>(null),
    retry = useRef<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null),
    [notice, setNotice] = useState(""),
    [demonstration, setDemonstration] = useState<"petrol" | "electric">(
      "petrol",
    ),
    [preview, setPreview] = useState("");
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  async function call(input: Record<string, unknown>) {
    const response = await fetch(`/api/listings/${listingId}/videos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await user.getIdToken()}`,
      },
      body: JSON.stringify(input),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error);
    return data;
  }
  async function upload(file: File) {
    retry.current = file;
    setNotice("");
    if (file.size > MAX_VIDEO_BYTES || file.size === 0) {
      setNotice("Choose an MP4 up to 100 MiB.");
      return;
    }
    onBusy(true);
    setProgress(0);
    let slot: { id: string; path: string } | undefined;
    try {
      slot = await call({
        action: "begin",
        demonstration: petrolRequired ? "petrol" : demonstration,
      });
      const current = uploadBytesResumable(ref(storage, slot!.path), file, {
        contentType: "video/mp4",
      });
      task.current = current;
      await new Promise<void>((resolve, reject) =>
        current.on(
          "state_changed",
          (snap) =>
            setProgress(
              Math.round((snap.bytesTransferred / snap.totalBytes) * 100),
            ),
          reject,
          () => resolve(),
        ),
      );
      task.current = null;
      setNotice("Upload complete. Checking the complete video…");
      const accepted = await call({ action: "validate", videoId: slot!.id });
      onChange(accepted);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(file));
      setNotice(
        "Video accepted for playback. Its content has not been independently verified.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Video upload failed.",
      );
      if (slot)
        try {
          await call({ action: "discard", videoId: slot.id });
        } catch {
          /* Keep the failed record for scheduled cleanup; never claim cleanup succeeded. */
        }
    } finally {
      task.current = null;
      setProgress(null);
      onBusy(false);
    }
  }
  return (
    <section className="running-video-upload">
      <h3>Motorcycle Running Video — Required</h3>
      <p>
        Show the actual bike starting where possible, idling and running
        briefly. Cold starts are welcome when clearly shown. Keep it outdoors or
        well ventilated; no excessive revving or unsafe riding. For electric
        bikes, show safe powered operation.
      </p>
      <p>
        15–60 seconds · up to 100 MiB · 720p or below · MP4 (H.264, AAC sound
        for petrol). MOV and WebM are not supported; export a compatible MP4
        first.
      </p>
      <label>
        Demonstration
        <select
          value={petrolRequired ? "petrol" : demonstration}
          disabled={progress !== null}
          onChange={(e) =>
            setDemonstration(e.target.value as "petrol" | "electric")
          }
        >
          <option value="petrol">Petrol — sound required</option>
          <option value="electric" disabled={petrolRequired}>
            Electric — powered operation
          </option>
        </select>
      </label>
      <div className="manage-row">
        <label className="button-secondary">
          {value ? "Replace video" : "Choose video"}
          <input
            type="file"
            accept="video/mp4,.mp4"
            disabled={progress !== null}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
        </label>
        <label className="button-secondary">
          Record with camera
          <input
            type="file"
            accept="video/*"
            capture="environment"
            disabled={progress !== null}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <small>
        Your phone may record MOV or HEVC. If validation rejects it, export
        H.264 MP4 at 720p and choose that file instead.
      </small>
      {progress !== null && (
        <>
          <progress
            max={100}
            value={progress}
            aria-label="Video upload progress"
          />
          <span>{progress}%</span>
          {task.current && (
            <button type="button" onClick={() => task.current?.cancel()}>
              Cancel upload
            </button>
          )}
        </>
      )}
      {value && (
        <>
          <p>
            Ready: {Math.round(value.duration)} seconds. Petrol audio-track
            checks do not prove engine sound or mechanical condition.
          </p>
          {preview ? (
            <video src={preview} controls preload="none" playsInline />
          ) : (
            <button
              type="button"
              onClick={async () => {
                try {
                  const blob = await getBlob(
                    ref(storage, value.path),
                    MAX_VIDEO_BYTES,
                  );
                  setPreview(URL.createObjectURL(blob));
                } catch {
                  setNotice("Preview unavailable. Try again.");
                }
              }}
            >
              Preview accepted video
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setNotice(
                "Video removed from this form. An active advert keeps its current video until a replacement is saved. You can save an incomplete draft, but cannot publish a motorcycle without a video.",
              );
            }}
          >
            Remove selection
          </button>
        </>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {retry.current && progress === null && (
        <button type="button" onClick={() => void upload(retry.current!)}>
          Retry upload
        </button>
      )}
      <p>
        A video helps buyers assess the advert; it is not independent mechanical
        verification. Non-running projects cannot be published under the
        running-video rule yet.
      </p>
    </section>
  );
}
