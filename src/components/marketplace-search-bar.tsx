"use client";
import { useEffect, useRef, useId } from "react";
import { useSearchDraft } from "./search-draft";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { CategoryPicker } from "./category-navigation";
import { categoryById, categoryPath } from "@/lib/taxonomy";
import { provinces } from "@/lib/marketplace";
import {
  defaultFilters,
  filtersFromParams,
  filtersUrl,
  type Filters,
} from "@/lib/search-contract";
import {
  alphabeticalMakes,
  chooseSearchCategory,
  suggestedItemBrands,
} from "@/lib/search-controls";

export function MarketplaceSearchBar() {
  const params = useSearchParams();
  const pathname = usePathname();
  const category = pathname.startsWith("/marketplace/")
    ? decodeURIComponent(pathname.slice(13))
    : "";
  const initial =
    pathname === "/browse" || category
      ? filtersFromParams(params, category)
      : { ...defaultFilters };
  const scope = `${pathname}?${params.toString()}`;
  return <SearchControls key={scope} initial={initial} scope={scope} />;
}
function SearchControls({
  initial,
  scope,
}: {
  initial: Filters;
  scope: string;
}) {
  const [filters, setFilters] = useSearchDraft(initial, scope);
  const router = useRouter();
  const bar = useRef<HTMLDivElement>(null);
  const categories = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const brandList = useId();
  const type = categoryById[filters.category]?.itemType;
  const mechanical = !type || type === "motorcycle" || type === "part";
  const categoryLabel =
    categoryPath(filters.category)
      .map((c) => c.name)
      .join(" / ") || "All categories";
  useEffect(() => {
    const measure = () =>
      document.documentElement.style.setProperty(
        "--market-search-height",
        `${bar.current?.getBoundingClientRect().height || 90}px`,
      );
    const observer = new ResizeObserver(measure);
    if (bar.current) observer.observe(bar.current);
    measure();
    const close = (event: PointerEvent) => {
      if (
        !categories.current?.contains(event.target as Node) &&
        categories.current
      )
        categories.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => {
      observer.disconnect();
      document.removeEventListener("pointerdown", close);
    };
  }, []);
  return (
    <div className="market-search-dock" ref={bar}>
      <form
        className="wrap market-search-form"
        aria-label="Search marketplace"
        onSubmit={(event) => {
          event.preventDefault();
          if (categories.current) categories.current.open = false;
          router.push(filtersUrl(filters));
        }}
      >
        <label className="market-search-field">
          <span>Brand</span>
          {mechanical ? (
            <select
              aria-label="Motorcycle brand"
              value={filters.make}
              onChange={(event) =>
                setFilters((f) => ({
                  ...f,
                  make: event.target.value,
                  model: "",
                }))
              }
            >
              <option value="">All brands</option>
              {alphabeticalMakes.map((make) => (
                <option key={make} value={make}>
                  {make}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input
                aria-label="Item brand"
                list={brandList}
                placeholder="Any brand"
                value={filters.brand}
                onChange={(event) =>
                  setFilters((f) => ({ ...f, brand: event.target.value }))
                }
              />
              <datalist id={brandList}>
                {suggestedItemBrands.map((brand) => (
                  <option key={brand} value={brand} />
                ))}
              </datalist>
            </>
          )}
        </label>
        <details
          className="search-category-menu"
          ref={categories}
          onKeyDown={(event) => {
            if (event.key === "Escape" && categories.current) {
              categories.current.open = false;
              summary.current?.focus();
            }
          }}
          onBlur={(event) => {
            if (
              event.relatedTarget &&
              !event.currentTarget.contains(event.relatedTarget)
            )
              event.currentTarget.open = false;
          }}
        >
          <summary ref={summary}>
            <span className="market-search-field">
              <span>Category</span>
              <span className="selected-category" title={categoryLabel}>
                {categoryLabel}
              </span>
            </span>
            <ChevronDown size={16} />
          </summary>
          <div
            className="search-category-panel"
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                event.target instanceof HTMLInputElement
              )
                event.preventDefault();
            }}
          >
            <div className="search-category-heading">
              <strong>What are you looking for?</strong>
              <button
                type="button"
                className="text-button"
                onClick={() => setFilters((f) => chooseSearchCategory(f, ""))}
              >
                All categories
              </button>
            </div>
            <CategoryPicker
              value={filters.category}
              onChange={(id) => setFilters((f) => chooseSearchCategory(f, id))}
            />
            <button
              type="button"
              className="button category-done"
              onClick={() => {
                if (categories.current) categories.current.open = false;
                summary.current?.focus();
              }}
            >
              Use this category
            </button>
          </div>
        </details>
        <label className="market-search-field">
          <span>Location</span>
          <select
            aria-label="Search by province"
            value={filters.region}
            onChange={(event) =>
              setFilters((f) => ({
                ...f,
                region: event.target.value,
                city: "",
              }))
            }
          >
            <option value="">All provinces</option>
            {Object.entries(provinces)
              .sort((a, b) => a[1].localeCompare(b[1], "en-ZA"))
              .map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
          </select>
        </label>
        <button className="button market-search-submit" type="submit">
          Search
        </button>
      </form>
    </div>
  );
}
