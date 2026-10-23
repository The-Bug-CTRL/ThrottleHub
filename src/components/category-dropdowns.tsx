"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { categoryChildren, categoryHref, Category } from "@/lib/taxonomy";
import { CategoryIcon } from "./category-icon";
export function CategoryDropdowns() {
  const [open, setOpen] = useState<string | null>(null);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  function branch(category: Category, depth = 0) {
    const children = categoryChildren(category.id);
    return (
      <div className="category-menu-branch" key={category.id}>
        <Link href={categoryHref(category.id)} onClick={() => setOpen(null)}>
          {category.level === 1 && category.itemType === "motorcycle" && (
            <CategoryIcon category={category.id} size={40} />
          )}
          {category.name}
        </Link>
        {children.length > 0 && depth < 2 && (
          <div>{children.map((child) => branch(child, depth + 1))}</div>
        )}
      </div>
    );
  }
  return (
    <nav
      ref={root}
      className="category-dropdown-nav"
      aria-label="Marketplace categories"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          const trigger = root.current?.querySelector<HTMLButtonElement>(
            '[aria-expanded="true"]',
          );
          setOpen(null);
          trigger?.focus();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(null);
      }}
    >
      <Link href="/browse">Latest listings</Link>
      {[{ id: "all", name: "All categories" }, ...categoryChildren()].map(
        (category) => (
          <div className="category-dropdown" key={category.id}>
            <button
              className="text-button category-dropdown-trigger"
              type="button"
              aria-expanded={open === category.id}
              aria-controls={`category-menu-${category.id}`}
              onClick={() => setOpen(open === category.id ? null : category.id)}
            >
              {category.id !== "all" && (
                <CategoryIcon category={category.id} size={44} />
              )}
              {category.name}
              <ChevronDown size={14} />
            </button>
            {open === category.id && (
              <div
                className="category-mega-menu"
                id={`category-menu-${category.id}`}
              >
                <Link
                  className="category-menu-all"
                  href={
                    category.id === "all"
                      ? "/browse"
                      : categoryHref(category.id)
                  }
                  onClick={() => setOpen(null)}
                >
                  Browse {category.name.toLowerCase()} &rarr;
                </Link>
                <div className="category-menu-columns">
                  {(category.id === "all"
                    ? categoryChildren()
                    : categoryChildren(category.id)
                  ).map((child) => branch(child))}
                </div>
              </div>
            )}
          </div>
        ),
      )}
    </nav>
  );
}
