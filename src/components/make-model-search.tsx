"use client";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import type { Filters } from "@/lib/search-contract";
import {
  alphabeticalMakes,
  suggestedItemBrands,
  searchModels,
  chooseSearchEngine,
} from "@/lib/search-controls";
export function MakeModelSearch({
  filters,
  onChange,
  mechanical,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  mechanical: boolean;
}) {
  const [open, setOpen] = useState(false),
    root = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null),
    id = useId();
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const term = filters.term.toLowerCase().trim(),
    makes = mechanical ? alphabeticalMakes : suggestedItemBrands;
  const choose = (next: Filters, close = false) => {
    onChange(next);
    input.current?.focus();
    setOpen(!close);
  };
  const engines = { "two-stroke": "2-stroke", "four-stroke": "4-stroke" };
  const matches = makes.filter((make) => make.toLowerCase().includes(term));
  const models =
    mechanical && term
      ? alphabeticalMakes
          .flatMap((make) =>
            searchModels(make)
              .filter(
                (model) =>
                  `${make} ${model}`.toLowerCase().includes(term) ||
                  model.toLowerCase().includes(term),
              )
              .map((model) => ({ make, model })),
          )
          .slice(0, 30)
      : [];
  return (
    <div
      className="make-model-search"
      ref={root}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          input.current?.focus();
          setOpen(false);
        }
        if (e.key === "Enter" && e.target === input.current) setOpen(false);
        if (e.key === "ArrowDown" && e.target === input.current) {
          e.preventDefault();
          setOpen(true);
          requestAnimationFrame(() =>
            root.current
              ?.querySelector<HTMLButtonElement>(
                ".make-model-panel .make-model-row",
              )
              ?.focus(),
          );
        }
      }}
      onBlur={(e) => {
        if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget))
          setOpen(false);
      }}
    >
      <div className="make-model-input">
        <Search size={18} />
        <input
          ref={input}
          role="combobox"
          aria-label="Search make, model or keyword"
          aria-expanded={open}
          aria-controls={id}
          aria-haspopup="dialog"
          autoComplete="off"
          maxLength={100}
          placeholder={
            mechanical
              ? "Type a make, model or keyword"
              : "Type a brand or keyword"
          }
          value={filters.term}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange({ ...filters, term: e.target.value });
            setOpen(true);
          }}
        />
        <button
          type="button"
          aria-label="Choose make and model"
          onClick={() => setOpen(!open)}
        >
          <ChevronDown size={17} />
        </button>
      </div>
      {(filters.make ||
        filters.brand ||
        filters.model ||
        filters.engineType) && (
        <div className="search-selections">
          <span>
            {[
              mechanical ? filters.make : filters.brand,
              engines[filters.engineType as keyof typeof engines],
              filters.model,
            ]
              .filter(Boolean)
              .join(" � ")}
          </span>
          <button
            type="button"
            aria-label="Clear make and model"
            onClick={() =>
              choose({
                ...filters,
                make: "",
                brand: "",
                model: "",
                engineType: "",
              })
            }
          >
            <X size={13} />
          </button>
        </div>
      )}
      {open && (
        <div
          className="make-model-panel"
          id={id}
          role="dialog"
          aria-label="Choose make, engine and model"
        >
          {mechanical && filters.make && !term ? (
            <>
              <div className="make-model-heading">
                <button
                  type="button"
                  onClick={() =>
                    choose({ ...filters, make: "", model: "", engineType: "" })
                  }
                >
                  All makes
                </button>
                <strong>{filters.make}</strong>
                <button
                  type="button"
                  aria-label="Close make selector"
                  onClick={() => setOpen(false)}
                >
                  <X size={17} />
                </button>
              </div>
              <p className="search-step-label">
                Choose an engine, then a model
              </p>
              <div className="search-engine-options">
                {[["", "Any engine"], ...Object.entries(engines)].map(
                  ([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={filters.engineType === value}
                      onClick={() => choose(chooseSearchEngine(filters, value))}
                    >
                      {label}
                    </button>
                  ),
                )}
              </div>
              <button
                type="button"
                className="make-model-row"
                onClick={() =>
                  choose({ ...filters, model: "", term: "" }, true)
                }
              >
                All {filters.make} models
                <ChevronRight size={16} />
              </button>
              {searchModels(filters.make, filters.engineType).map((model) => (
                <button
                  className="make-model-row"
                  type="button"
                  key={model}
                  aria-pressed={filters.model === model}
                  onClick={() => choose({ ...filters, model, term: "" }, true)}
                >
                  {model}
                  <ChevronRight size={16} />
                </button>
              ))}
            </>
          ) : (
            <>
              <div className="make-model-heading">
                <strong>{term ? "Suggestions" : "Choose a make"}</strong>
                <button
                  type="button"
                  aria-label="Close make selector"
                  onClick={() => setOpen(false)}
                >
                  <X size={17} />
                </button>
              </div>
              {matches.map((make) => (
                <button
                  type="button"
                  className="make-model-row"
                  key={make}
                  onClick={() =>
                    choose(
                      {
                        ...filters,
                        ...(mechanical
                          ? { make, model: "", engineType: "" }
                          : { brand: make }),
                        term: "",
                      },
                      !mechanical,
                    )
                  }
                >
                  {make}
                  <span>
                    {mechanical ? "Models" : ""}
                    <ChevronRight size={16} />
                  </span>
                </button>
              ))}
              {models.length > 0 && (
                <p className="search-step-label">Matching models</p>
              )}
              {models.map(({ make, model }) => (
                <button
                  type="button"
                  className="make-model-row"
                  key={make + model}
                  onClick={() =>
                    choose(
                      { ...filters, make, model, engineType: "", term: "" },
                      true,
                    )
                  }
                >
                  {make} {model}
                  <ChevronRight size={16} />
                </button>
              ))}
              {term && (
                <p className="search-text-hint">
                  Press Search to look for �{filters.term}� in listings.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
