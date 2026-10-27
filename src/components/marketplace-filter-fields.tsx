"use client";
import type { Dispatch, SetStateAction } from "react";
import type { Filters } from "@/lib/search-contract";
import { categoryById } from "@/lib/taxonomy";
import { provinces } from "@/lib/marketplace";
import {
  alphabeticalMakes,
  chooseSearchCategory,
  chooseSearchEngine,
  searchModels,
} from "@/lib/search-controls";
import { CategoryPicker } from "./category-navigation";
export function MarketplaceFilterFields({
  filters,
  onChange: setFilters,
}: {
  filters: Filters;
  onChange: Dispatch<SetStateAction<Filters>>;
}) {
  const change = (key: keyof Filters, value: string) =>
    setFilters((f) =>
      key === "engineType"
        ? chooseSearchEngine(f, value)
        : {
            ...f,
            [key]: value,
            ...(key === "make" ? { model: "", engineType: "" } : {}),
            ...(key === "region" ? { city: "" } : {}),
          },
    );

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
        maxLength={key === "term" ? 100 : undefined}

        title={key === "term" ? "e.g. Yamaha YZ250 or riding boots" : undefined}
        placeholder={key === "term" ? "e.g. Yamaha YZ250" : undefined}
        value={filters[key]}
        onChange={(e) => change(key, e.target.value)}
      />
    </label>
  );

  return (
    <div className="filter-fields">
      <details className="sidebar-category">
        <summary>
          Category: {categoryById[filters.category]?.name || "All categories"}
        </summary>
        <CategoryPicker
          value={filters.category}
          onChange={(id) => setFilters((f) => chooseSearchCategory(f, id))}
        />
      </details>
      {mechanical && select("make", "Make", alphabeticalMakes)}
      {mechanical &&
        select("engineType", "Engine", {
          "two-stroke": "2-stroke",
          "four-stroke": "4-stroke",
        })}
      {input("term", "Search words")}
      {select("region", "Province", provinces)}
      <div className="field-row">
        {input("min", "Min price (R)", true)}
        {input("max", "Max price (R)", true)}
      </div>
      {select("condition", "Condition", ["New", "Excellent", "Good", "Used"])}
      {mechanical && (
        <>
          {filters.make &&
            select(
              "model",
              "Model",
              searchModels(filters.make, filters.engineType),
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
          filters.year,
          filters.engineType,
          filters.displacement,
          filters.maxHours,
          filters.fuelSystem,
          filters.origin,
          filters.vintage,
          filters.size,
          filters.sizeSystem,
          filters.sellerType,
          filters.shipping,
          filters.city,
        ].some(Boolean)}
      >
        <summary>More filters</summary>
        <div className="advanced-filter-fields">
          {mechanical && (
            <>
              {input("year", "Exact model year", true)}
              {input("displacement", "Engine size (cc)", true)}
              {type !== "part" && input("maxHours", "Max riding hours", true)}
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
          {type !== "motorcycle" && input("brand", "Brand (optional)")}
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
            dealer: "Business Seller",
          })}
          {select("shipping", "Delivery", [
            "Collection only",
            "Domestic shipping",
          ])}
        </div>
      </details>
    </div>
  );
}
