import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/server";
import { sellerListingStats } from "@/lib/listing-engagement";
import { ListingError } from "@/lib/listing-lifecycle";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const db = adminDb(),
      token = request.headers.get("authorization");
    if (!token?.startsWith("Bearer "))
      throw new ListingError("Sign in first.", 401);
    let uid;
    try {
      uid = (await getAuth().verifyIdToken(token.slice(7), true)).uid;
    } catch {
      throw new ListingError("Sign in again.", 401);
    }
    return NextResponse.json(
      await sellerListingStats(db, (await params).id, uid),
      { headers },
    );
  } catch (error) {
    if (error instanceof ListingError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers },
      );
    return NextResponse.json(
      { error: "Stats unavailable. Try again." },
      { status: 503, headers },
    );
  }
}
