import { LoadingState } from "@/components/ui/primitives";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CategoryIcon } from "@/components/category-icon";
import { Browse } from "@/components/browse";
import { CategoryBreadcrumbs } from "@/components/category-navigation";
import { categoryById, categoryChildren, categoryHref } from "@/lib/taxonomy";
import { brand } from "@/lib/config";
type Props = { params: Promise<{ slug: string[] }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = (await params).slug.join("/");
  const c = categoryById[id];
  if (!c?.isActive)
    return { title: "Category not found", robots: { index: false } };
  return {
    title: `${c.name} for sale in South Africa`,
    description: `Browse ${c.name.toLowerCase()} from South African off-road riders. Filter by location, condition and relevant specifications.`,
    alternates: { canonical: `${brand.domain}${categoryHref(id)}` },
  };
}
export default async function Page({ params }: Props) {
  const id = (await params).slug.join("/");
  const c = categoryById[id];
  if (!c?.isActive) notFound();
  const children = categoryChildren(id);
  return (
    <>
      <div className="wrap category-landing">
        <CategoryBreadcrumbs id={id} />
        <h1 className="category-title">
          <CategoryIcon category={id} size={72} />
          {c.name}
        </h1>
        {children.length > 0 && (
          <nav
            className="category-children"
            aria-label={`${c.name} subcategories`}
          >
            {children.map((child) => (
              <Link key={child.id} href={categoryHref(child.id)}>
                <CategoryIcon category={child.id} size={48} />
                {child.name} →
              </Link>
            ))}
          </nav>
        )}
      </div>
      <Suspense
        fallback={
          <section className="wrap section">
            <LoadingState size={144} label="Loading marketplace…" />
          </section>
        }
      >
        <Browse categoryId={id} />
      </Suspense>
    </>
  );
}
