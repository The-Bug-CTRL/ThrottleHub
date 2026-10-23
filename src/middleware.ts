import { NextRequest, NextResponse } from "next/server";
import { categoryById, categoryPath, resolveCategoryId } from "./lib/taxonomy";
// Reject invalid paths before streaming starts, preserving an actual HTTP 404.
export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/listing/")) {
    const segments = request.nextUrl.pathname.split("/");
    const id = segments[2];
    const unavailable = () =>
      NextResponse.rewrite(new URL("/listing-not-found", request.url), {
        status: 404,
        headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
      });
    if (segments.length !== 4 || !/^[a-zA-Z0-9_-]{1,128}$/.test(id))
      return unavailable();
    try {
      const result = await fetch(
        new URL(`/api/listings/${id}/availability`, request.url),
        { cache: "no-store" },
      );
      if (result.status === 404) return unavailable();
      if (!result.ok)
        return new NextResponse(
          "Listings temporarily unavailable. Please try again.",
          {
            status: 503,
            headers: { "Cache-Control": "no-store", "Retry-After": "60" },
          },
        );
      const { canonical } = await result.json();
      if (canonical !== request.nextUrl.pathname)
        return NextResponse.redirect(new URL(canonical, request.url), 308);
      return NextResponse.next({ headers: { "Cache-Control": "no-store" } });
    } catch {
      return new NextResponse(
        "Listings temporarily unavailable. Please try again.",
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  }
  let id = "";
  try {
    id = decodeURIComponent(
      request.nextUrl.pathname.slice("/marketplace/".length),
    ).replace(/\/$/, "");
  } catch {
    /* handled as an invalid category */
  }
  const resolved = resolveCategoryId(id);
  if (resolved !== id) {
    const url = request.nextUrl.clone();
    url.pathname = `/marketplace/${resolved}`;
    return NextResponse.redirect(url, 308);
  }
  if (!categoryById[id] || categoryPath(id).some((c) => !c.isActive)) {
    return NextResponse.rewrite(new URL("/category-not-found", request.url), {
      status: 404,
    });
  }
  return NextResponse.next();
}
export const config = { matcher: ["/marketplace/:path*", "/listing/:path*"] };
