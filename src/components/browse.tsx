"use client";
import { RoostLoader } from "@/components/loading/roost-loader";
import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useSearchDraft } from "./search-draft";
import Link from "next/link";
import { motorcycleCatalogue } from "@/lib/marketplace";
import { categoryById } from "@/lib/taxonomy";
import { provinces } from "@/lib/marketplace";
import { Listing } from "@/lib/models";
import { searchListings } from "@/lib/search";
import {
  Filters,
  SearchCursor,
  defaultFilters,
  filtersFromParams,
  filtersUrl,
} from "@/lib/search-contract";
import { Card } from "./card";
import { SaveSearch } from "./saved-searches";
import { LoadingState } from "./ui/primitives";
export function Browse({ categoryId = "" }: { categoryId?: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [filters, setFilters] = useSearchDraft(
    filtersFromParams(params, categoryId),
    `${pathname}?${params.toString()}`,
  );
  const [items, setItems] = useState<Listing[]>([]);
  const [cursor, setCursor] = useState<SearchCursor>();
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState(filters);
  const [refinementsOpen, setRefinementsOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 901px)");
    const update = () => setRefinementsOpen(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const activeQuery = useRef(applied);
  activeQuery.current = applied;
  const queryKey = params.toString();
  useEffect(() => {
    const next = filtersFromParams(new URLSearchParams(queryKey), categoryId);
    setFilters(next);
    setApplied((old) =>
      JSON.stringify(old) === JSON.stringify(next) ? old : next,
    );
  }, [queryKey, categoryId, setFilters]);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    setItems([]);
    setMore(false);
    setCursor(undefined);
    searchListings(applied)
      .then((r) => {
        if (active) {
          setItems(r.items);
          setMore(r.more);
          setCursor(r.cursor);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [applied]);
  const change = (key: keyof Filters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const apply = (next: Filters) => {
    setFilters(next);
    setApplied(next);
    router.replace(filtersUrl(next), { scroll: false });
  };
  const type = categoryById[filters.category]?.itemType;
  const mechanical = !type || type === "motorcycle" || type === "part";
  const select = (
    key: keyof Filters,
    label: string,
    values: string[] | Record<string, string>,
  ) => (
    <label>
      {label}
      <select
        value={filters[key]}
        onChange={(e) => change(key, e.target.value)}
      >
        <option value="">Any</option>
        {(Array.isArray(values)
          ? values.map((v) => [v, v])
          : Object.entries(values)
        ).map(([v, n]) => (
          <option key={v} value={v}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
  const input = (key: keyof Filters, label: string, number = false) => (
    <label>
      {label}
      <input
        type={number ? "number" : "text"}
        min={number ? 0 : undefined}
        maxLength={key === "term" ? 20 : undefined}
        pattern={key === "term" ? "[A-Za-z0-9]{1,20}" : undefined}
        title={
          key === "term" ? "One word, such as piston or helmet" : undefined
        }
        placeholder={key === "term" ? "e.g. piston" : undefined}
        value={filters[key]}
        onChange={(e) => change(key, e.target.value)}
      />
    </label>
  );
  return (
    <section className="wrap section browse">
      <div className="eyebrow">SOUTH AFRICAN MARKETPLACE</div>
      {!categoryId && <h1>Find your next ride.</h1>}
      <div className="browse-layout">
        <details
          className="marketplace-refinements"
          open={refinementsOpen}
          onToggle={(event) => setRefinementsOpen(event.currentTarget.open)}
        >
          <summary>Refine your search</summary>
          <form
            className="filters v2-filters"
            onSubmit={(event) => {
              event.preventDefault();
              apply(filters);
            }}
          >
            <div className="filter-fields">
              {input("term", "Keyword (optional)")}
              <div className="field-row">
                {input("min", "Min price (R)", true)}
                {input("max", "Max price (R)", true)}
              </div>
              {select("condition", "Condition", [
                "New",
                "Excellent",
                "Good",
                "Used",
              ])}
              {mechanical && (
                <>
                  {filters.make &&
                    select(
                      "model",
                      "Model",
                      [...(motorcycleCatalogue[filters.make] || [])].sort(
                        (a, b) => a.localeCompare(b, "en-ZA"),
                      ),
                    )}
                  <div className="field-row">
                    {input("yearFrom", "Year from", true)}
                    {input("yearTo", "Year to", true)}
                  </div>
                </>
              )}
              <details
                className="advanced-filters"
                open={[
                  applied.year,
                  applied.engineType,
                  applied.displacement,
                  applied.maxHours,
                  applied.fuelSystem,
                  applied.origin,
                  applied.vintage,
                  applied.size,
                  applied.sizeSystem,
                  applied.sellerType,
                  applied.shipping,
                  applied.city,
                ].some(Boolean)}
              >
                <summary>More filters</summary>
                <div className="advanced-filter-fields">
                  {mechanical && (
                    <>
                      {input("year", "Exact model year", true)}
                      {select("engineType", "Engine", {
                        "two-stroke": "Two-stroke",
                        "four-stroke": "Four-stroke",
                      })}
                      {input("displacement", "Engine size (cc)", true)}
                      {type !== "part" &&
                        input("maxHours", "Max riding hours", true)}
                      {select("fuelSystem", "Fuel system", {
                        carburettor: "Carburettor",
                        "fuel-injection": "Fuel injection",
                      })}
                      {type !== "motorcycle" &&
                        select("origin", "Part type", ["OEM", "aftermarket"])}
                      {select("vintage", "Vintage items", {
                        true: "Vintage only",
                      })}
                    </>
                  )}
                  {mechanical &&
                    type !== "motorcycle" &&
                    input("brand", "Part / equipment brand")}
                  {(!type || type === "gear") && (
                    <>
                      {input("size", "Size")}
                      {select("sizeSystem", "Sizing", [
                        "UK",
                        "US",
                        "EU",
                        "alpha",
                        "cm",
                      ])}
                    </>
                  )}
                  {input("city", "Town or city")}
                  {select("sellerType", "Seller", {
                    private: "Private seller",
                    dealer: "Dealership",
                  })}
                  {select("shipping", "Delivery", [
                    "Collection only",
                    "Domestic shipping",
                  ])}
                </div>
              </details>
            </div>
            <div className="filter-actions">
              <button className="button" type="submit">
                Apply filters
              </button>
              <button
                className="text-button"
                type="button"
                onClick={() => apply({ ...defaultFilters })}
              >
                Clear filters
              </button>
            </div>
          </form>
        </details>
        <div>
          <div className="active-filters" aria-label="Applied filters">
            {Object.entries(applied)
              .filter(([k, v]) => v && !["country", "sort"].includes(k))
              .map(([k, v]) => (
                <button
                  key={k}
                  className="filter-chip"
                  onClick={() =>
                    apply({
                      ...applied,
                      [k]: "",
                      ...(k === "make" ? { model: "" } : {}),
                    })
                  }
                  aria-label={"Remove " + k + " filter"}
                >
                  {k}:{" "}
                  {k === "category"
                    ? categoryById[v]?.name
                    : k === "region"
                      ? provinces[v as keyof typeof provinces]
                      : v}{" "}
                  &times;
                </button>
              ))}
          </div>
          <SaveSearch filters={applied} />
          <div className="results-heading">
            <span>
              {busy && items.length > 0 ? (
                <RoostLoader size={64} label="Updating listings" />
              ) : busy ? (
                "Searching…"
              ) : (
                items.length + " listings loaded"
              )}
            </span>
            <select
              aria-label="Sort listings"
              value={applied.sort}
              onChange={(e) => apply({ ...applied, sort: e.target.value })}
            >
              {Object.entries({
                newest: "Newest first",
                oldest: "Oldest first",
                "price-asc": "Price: low to high",
                "price-desc": "Price: high to low",
              }).map(([v, n]) => (
                <option key={v} value={v}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          {busy && !items.length ? (
            <LoadingState size={144} label="Searching listings…" />
          ) : (
            <div className="listing-grid browse-grid">
              {items.map((l) => (
                <Card key={l.id} listing={l} />
              ))}
            </div>
          )}
          {!busy && !items.length && !error && (
            <div className="empty">
              <h2>
                {more
                  ? "No matches in this page of candidates."
                  : "No listings found."}
              </h2>
              <p>
                {more
                  ? "Continue searching the next page, or narrow the category."
                  : "Try another category or widen your South African location."}
              </p>
              <Link href="/sell">List an item</Link>
            </div>
          )}
          {more && (
            <button
              className="button load-more"
              disabled={busy}
              onClick={async () => {
                const requested = applied;
                setBusy(true);
                setError("");
                try {
                  const r = await searchListings(applied, cursor);
                  if (activeQuery.current !== requested) return;
                  setItems((old) => [...old, ...r.items]);
                  setCursor(r.cursor);
                  setMore(r.more);
                } catch (e) {
                  if (activeQuery.current === requested)
                    setError(
                      e instanceof Error ? e.message : "Could not load more.",
                    );
                } finally {
                  if (activeQuery.current === requested) setBusy(false);
                }
              }}
            >
              {busy ? "Searching..." : "Search next page / load more"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
