"use client";
import { useState } from "react";
export function RunningVideoPlayer({
  listingId,
  poster,
  available,
  motorcycle = true,
}: {
  listingId: string;
  poster?: string;
  available: boolean;
  motorcycle?: boolean;
}) {
  const [play, setPlay] = useState(false),
    [failed, setFailed] = useState(false);
  return (
    <section className="running-video-player">
      <h2>{motorcycle ? "Watch this motorcycle running" : "Seller video"}</h2>
      <p>Seller-supplied footage, not an independent mechanical inspection.</p>
      {!available ? (
        <p>
          This older advert does not have a running video. Existing historical
          records have been preserved.
        </p>
      ) : failed ? (
        <p role="status">
          Video temporarily unavailable. Please try again later.
        </p>
      ) : play ? (
        <video
          src={`/api/listings/${listingId}/video`}
          poster={poster}
          controls
          playsInline
          preload="none"
          onError={() => setFailed(true)}
        />
      ) : (
        <button
          type="button"
          className="button-secondary"
          onClick={() => setPlay(true)}
        >
          {motorcycle ? "Watch running video" : "Watch seller video"} — uses
          mobile data
        </button>
      )}
      <p>
        Use “Report listing” to report an unrelated, unsafe or misleading video.
      </p>
    </section>
  );
}
