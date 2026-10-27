import { boundedText, RequestBodyError } from "@/lib/request-body";
import { finishListingMedia } from "@/lib/listing-media";
import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { adminDb } from "@/lib/server";
import { firebaseMode } from "@/lib/firebase-settings";
import {
  ListingError,
  mutateListing,
  validateListingImages,
} from "@/lib/listing-lifecycle";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const db = adminDb(); // Initialise and enforce the configured project before verifying a token.
    const bearer = request.headers.get("authorization");
    if (!bearer?.startsWith("Bearer "))
      return NextResponse.json(
        { error: "Sign in first." },
        { status: 401, headers },
      );
    let token;
    try {
      token = await getAuth().verifyIdToken(bearer.slice(7), true);
    } catch {
      return NextResponse.json(
        { error: "Your session has expired. Sign in again." },
        { status: 401, headers },
      );
    }
    if (Number(request.headers.get("content-length") || 0) > 50000)
      throw new ListingError("Request too large.", 413);
    const raw = await boundedText(request, 50000);
    if (raw.length > 50000) throw new ListingError("Request too large.", 413);
    let input: Record<string, unknown>;
    try {
      input = JSON.parse(raw);
    } catch {
      throw new ListingError("Invalid request.");
    }
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new ListingError("Invalid request.");
    const { id } = await params;
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;
    if (input.action === "save")
      validateListingImages(
        input.images,
        token.uid,
        id,
        bucketName,
        firebaseMode === "emulator",
      );
    const result = await mutateListing(
      db,
      id,
      {
        uid: token.uid,
        admin: token.admin === true,
        moderator: token.moderator === true,
      },
      input,
      Date.now(),
      getStorage().bucket(bucketName),
    );
    try {
      await finishListingMedia(db, id, getStorage().bucket(bucketName));
    } catch (error) {
      console.error("Listing media cleanup pending", id, error);
      return NextResponse.json(
        {
          ...result,
          cleanupPending: true,
          warning:
            "The listing update is saved. Media cleanup needs a retry; use Retry media cleanup or contact support.",
        },
        { status: 202, headers },
      );
    }
    return NextResponse.json(result, { headers });
  } catch (error) {
    if (error instanceof ListingError || error instanceof RequestBodyError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers },
      );
    console.error("Listing update failed", error);
    return NextResponse.json(
      { error: "Unable to update this advert. Please try again." },
      { status: 503, headers },
    );
  }
}
