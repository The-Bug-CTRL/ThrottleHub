"use client";
import Link from "next/link";
import { useState } from "react";
import {
  categoryById,
  categoryChildren,
  categoryHref,
  categoryPath,
  taxonomy,
} from "@/lib/taxonomy";
export function CategoryBreadcrumbs({ id }: { id: string }) {
  return (
    <nav className="breadcrumbs" aria-label="Category breadcrumbs">
      <Link href="/browse">Marketplace</Link>
      {categoryPath(id).map((c) => (
        <span key={c.id}>
          {" "}
          / <Link href={categoryHref(c.id)}>{c.name}</Link>
        </span>
      ))}
    </nav>
  );
}
export function CategoryPicker({
  value,
  onChange,
  engineType = "",
  required = false,
}: {
  value: string;
  onChange: (id: string) => void;
  engineType?: string;
  required?: boolean;
}) {
  const [term, setTerm] = useState("");
  const path = categoryPath(value);
  const levels = [null, ...path.map((c) => c.id)].filter(
    (id) => categoryChildren(id, engineType).length,
  );
  const results =
    term.length >= 2
      ? taxonomy
          .filter(
            (c) =>
              c.isActive &&
              (!engineType ||
                !c.engineTypes ||
                c.engineTypes.includes(engineType)) &&
              categoryPath(c.id)
                .map((p) => p.name)
                .join(" ")
                .toLowerCase()
                .includes(term.toLowerCase()),
          )
          .slice(0, 20)
      : [];
  return (
    <div className="category-picker">
      <label>
        Find a category
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="e.g. cylinder heads or GPS watches"
        />
      </label>
      {term.length >= 2 && (
        <div className="category-search-results">
          {results.length ? (
            results.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => {
                  onChange(c.id);
                  setTerm("");
                }}
              >
                {categoryPath(c.id)
                  .map((p) => p.name)
                  .join(" › ")}
              </button>
            ))
          ) : (
            <p>No matching categories.</p>
          )}
        </div>
      )}
      {levels.map((parent, i) => (
        <label key={parent || "root"}>
          {i ? "Narrow your category" : "Main category"}
          <select
            required={required && i === 0}
            value={path[i]?.id || ""}
            onChange={(e) => onChange(e.target.value || parent || "")}
          >
            <option value="">
              {i ? `All ${categoryById[parent!].name}` : "All categories"}
            </option>
            {categoryChildren(parent, engineType).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      ))}
      {value && (
        <p className="muted">
          {path.map((c) => c.name).join(" › ")}{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => onChange(categoryById[value]?.parentId || "")}
          >
            Back one level
          </button>
        </p>
      )}
    </div>
  );
}
