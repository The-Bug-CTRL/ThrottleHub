import { NextResponse } from "next/server";
import { getListing } from "@/lib/server";
import { listingHref } from "@/lib/listing-history";
export const dynamic = "force-dynamic";
// Public minimal lookup for middleware: resolves availability before a loading boundary streams.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
  try {
    const listing = await getListing((await params).id);
    return NextResponse.json(
      listing
        ? { canonical: listingHref(listing) }
        : { error: "Listing unavailable." },
      { status: listing ? 200 : 404, headers },
    );
  } catch {
    return NextResponse.json(
      { error: "Listings temporarily unavailable." },
      { status: 503, headers },
    );
  }
}
