import type { MetadataRoute } from "next";
import { brand, seoEnabled } from "@/lib/config";
import { taxonomy, categoryHref } from "@/lib/taxonomy";
export default function sitemap(): MetadataRoute.Sitemap {
  return seoEnabled
    ? taxonomy
        .filter((c) => c.isActive)
        .map((c) => ({ url: brand.domain + categoryHref(c.id) }))
    : [];
}
