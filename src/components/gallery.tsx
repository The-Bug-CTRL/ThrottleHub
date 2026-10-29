"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
export function Gallery({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const [selected, setSelected] = useState(0),
    [zoom, setZoom] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const start = useRef({ x: 0, y: 0 });
  const items = images.length ? images : ["/no-photo.svg"];
  useEffect(() => setSelected(0), [images]);
  function move(step: number) {
    setSelected((i) => (i + step + items.length) % items.length);
  }
  useEffect(() => {
    if (!zoom) {
      dialog.current?.close();
      return;
    }
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const element = dialog.current;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [zoom]);
  return (
    <div className="gallery">
      <div
        className="detail-photo"
        onTouchStart={(e) => {
          start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }}
        onTouchEnd={(e) => {
          const delta = e.changedTouches[0].clientX - start.current.x;
          const vertical = e.changedTouches[0].clientY - start.current.y;
          if (Math.abs(delta) > 45 && Math.abs(delta) > Math.abs(vertical))
            move(delta > 0 ? -1 : 1);
        }}
      >
        <img
          src={items[selected]}
          alt={`${title} — photograph ${selected + 1}`}
          fetchPriority="high"
          decoding="async"
        />
        {images.length > 0 && (
          <button
            className="icon-button gallery-expand"
            aria-label="View larger photograph"
            onClick={() => setZoom(true)}
          >
            <Expand size={19} />
          </button>
        )}
        <span className="gallery-count">
          {selected + 1} / {items.length}
        </span>
        {items.length > 1 && (
          <>
            <button
              className="icon-button gallery-prev"
              aria-label="Previous photograph"
              onClick={() => move(-1)}
            >
              <ChevronLeft />
            </button>
            <button
              className="icon-button gallery-next"
              aria-label="Next photograph"
              onClick={() => move(1)}
            >
              <ChevronRight />
            </button>
          </>
        )}
      </div>
      {items.length > 1 && (
        <div className="thumbnails" aria-label="Listing photographs">
          {items.map((src, i) => (
            <button
              aria-label={`Photograph ${i + 1}`}
              aria-pressed={selected === i}
              className={selected === i ? "active" : ""}
              key={src}
              onClick={() => setSelected(i)}
            >
              <img src={src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      <dialog
        ref={dialog}
        className="gallery-dialog"
        aria-label={`${title} photograph viewer`}
        onCancel={() => setZoom(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") move(-1);
          if (e.key === "ArrowRight") move(1);
        }}
      >
        <button
          className="icon-button"
          aria-label="Close photograph viewer"
          onClick={() => setZoom(false)}
        >
          <X />
        </button>
        <img
          src={items[selected]}
          alt={`${title} photograph ${selected + 1}`}
        />
        {items.length > 1 && (
          <div>
            <button aria-label="Previous photograph" onClick={() => move(-1)}>
              <ChevronLeft />
            </button>
            <span>
              {selected + 1} of {items.length}
            </span>
            <button aria-label="Next photograph" onClick={() => move(1)}>
              <ChevronRight />
            </button>
          </div>
        )}
      </dialog>
    </div>
  );
}
