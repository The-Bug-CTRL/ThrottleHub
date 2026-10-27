"use client";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { Play, X, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import type { ImportedVideo } from "@/lib/imported-video";

export function VideoPlayback({
  video,
  onClose,
}: {
  video: ImportedVideo;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    title = useId();
  useEffect(() => {
    const element = dialog.current,
      previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="content-video-dialog"
      aria-labelledby={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          onClose();
      }}
    >
      <header>
        <h2 id={title}>{video.title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close video"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </header>
      {video.embedUrl ? (
        <iframe
          className="content-video-player"
          src={`${video.embedUrl}?rel=0`}
          title={video.title}
          allow="encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <p>This video is available on YouTube.</p>
      )}
      <p>{video.channelName}</p>
      <p>
        If playback is unavailable or embedding has been disabled, open the
        original video.
      </p>
      <a
        className="button"
        href={video.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open on YouTube <ExternalLink size={16} />
      </a>
    </dialog>
  );
}
export function ContentVideoCard({
  video,
  onPlay,
}: {
  video: ImportedVideo;
  onPlay: (video: ImportedVideo) => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <article className="content-video-card">
      <button
        type="button"
        className="content-video-thumbnail"
        aria-label={`Play ${video.title}`}
        onClick={() => onPlay(video)}
      >
        {video.thumbnailUrl && !failed ? (
          <Image
            src={video.thumbnailUrl}
            alt=""
            width={480}
            height={360}
            sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="news-brand-fallback">
            <strong>ThrottleHub</strong>
            <span>RACING & VIDEOS</span>
          </span>
        )}
        <span className="content-video-play" aria-hidden="true">
          <Play size={20} fill="currentColor" />
        </span>
      </button>
      <div className="content-video-info">
        <h3>
          <button
            type="button"
            className="text-button"
            title={video.title}
            onClick={() => onPlay(video)}
          >
            {video.title}
          </button>
        </h3>
        <p>{[video.channelName, video.category].filter(Boolean).join(" · ")}</p>
      </div>
    </article>
  );
}

export function RacingHighlightsCarousel({
  videos,
}: {
  videos: ImportedVideo[];
}) {
  const track = useRef<HTMLDivElement>(null),
    trackId = useId(),
    helpId = useId();
  const [playing, setPlaying] = useState<ImportedVideo | null>(null);
  const [edges, setEdges] = useState({ start: true, end: videos.length <= 1 });
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const update = () =>
      setEdges({
        start: element.scrollLeft <= 2,
        end:
          element.scrollLeft + element.clientWidth >= element.scrollWidth - 2,
      });
    update();
    element.addEventListener("scroll", update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(element);
    return () => {
      element.removeEventListener("scroll", update);
      resize.disconnect();
    };
  }, [videos.length]);
  function move(direction: number | "start" | "end") {
    const element = track.current;
    if (!element) return;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? "auto"
      : "smooth";
    if (typeof direction === "string")
      element.scrollTo({
        left: direction === "start" ? 0 : element.scrollWidth,
        behavior,
      });
    else {
      const card = element.firstElementChild as HTMLElement | null;
      const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
      element.scrollBy({
        left:
          direction *
          ((card?.getBoundingClientRect().width || element.clientWidth) + gap),
        behavior,
      });
    }
  }
  if (!videos.length) return null;
  return (
    <div
      className="racing-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Latest racing highlights"
    >
      <div className="racing-carousel-controls">
        <button
          type="button"
          className="icon-button"
          aria-label="Previous racing videos"
          aria-controls={trackId}
          disabled={edges.start}
          onClick={() => move(-1)}
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Next racing videos"
          aria-controls={trackId}
          disabled={edges.end}
          onClick={() => move(1)}
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <p id={helpId} className="sr-only">
        Swipe to browse, or use Left and Right arrow keys. Home and End jump to
        the first and last videos.
      </p>
      <div
        id={trackId}
        ref={track}
        className="racing-carousel-track"
        tabIndex={0}
        aria-label="Racing videos"
        aria-describedby={helpId}
        onKeyDown={(event) => {
          if (event.altKey || event.ctrlKey || event.metaKey) return;
          const direction =
            event.key === "ArrowLeft"
              ? -1
              : event.key === "ArrowRight"
                ? 1
                : event.key === "Home"
                  ? "start"
                  : event.key === "End"
                    ? "end"
                    : null;
          if (direction !== null) {
            event.preventDefault();
            move(direction);
          }
        }}
      >
        {videos.map((video, index) => (
          <div
            className="racing-carousel-slide"
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${videos.length}`}
            key={video.id}
            onFocus={(event) => {
              const element = track.current,
                slide = event.currentTarget;
              if (
                element &&
                (slide.offsetLeft < element.scrollLeft ||
                  slide.offsetLeft + slide.offsetWidth >
                    element.scrollLeft + element.clientWidth)
              )
                slide.scrollIntoView({
                  block: "nearest",
                  inline: "nearest",
                  behavior: "auto",
                });
            }}
          >
            <ContentVideoCard video={video} onPlay={setPlaying} />
          </div>
        ))}
      </div>
      {playing && (
        <VideoPlayback video={playing} onClose={() => setPlaying(null)} />
      )}
    </div>
  );
}
