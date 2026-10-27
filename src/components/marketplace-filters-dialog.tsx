"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { X, SlidersHorizontal } from "lucide-react";
import { MarketplaceFilterFields } from "./marketplace-filter-fields";
import {
  defaultFilters,
  validateFilters,
  type Filters,
} from "@/lib/search-contract";
export function MarketplaceFiltersDialog({
  filters,
  onChange,
  onApply,
  onClose,
}: {
  filters: Filters;
  onChange: Dispatch<SetStateAction<Filters>>;
  onApply: (filters: Filters) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    title = useId(),
    description = useId();
  const [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current,
      previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  const change: Dispatch<SetStateAction<Filters>> = (next) => {
    setError("");
    onChange(next);
  };
  return (
    <dialog
      ref={dialog}
      className="marketplace-filters-dialog"
      aria-labelledby={title}
      aria-describedby={description}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          onClose();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          try {
            onApply(validateFilters(filters));
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Check your filters and try again.",
            );
          }
        }}
      >
        <header className="filters-dialog-heading">
          <div>
            <h2 id={title}>
              <SlidersHorizontal size={20} />
              Filters
            </h2>
            <p id={description}>
              Narrow it down. You can also change these beside your results.
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close filters"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </header>
        <div className="filters-dialog-body">
          <MarketplaceFilterFields filters={filters} onChange={change} />
        </div>
        <footer className="filters-dialog-actions">
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            className="text-button"
            onClick={() => change({ ...defaultFilters })}
          >
            Clear filters
          </button>
          <button type="submit" className="button">
            Apply filters &amp; search
          </button>
        </footer>
      </form>
    </dialog>
  );
}
