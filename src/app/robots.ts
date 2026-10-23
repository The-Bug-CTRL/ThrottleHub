import type { MetadataRoute } from "next";
import { brand, seoEnabled } from "@/lib/config";
export default function robots(): MetadataRoute.Robots {
  return seoEnabled
    ? {
        rules: {
          userAgent: "*",
          allow: "/",
          disallow: [
            "/account",
            "/admin",
            "/messages",
            "/sell",
            "/auth",
            "/api",
            "/browse?",
          ],
        },
        sitemap: brand.domain + "/sitemap.xml",
      }
    : { rules: { userAgent: "*", disallow: "/" } };
}
