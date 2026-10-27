import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { adminDb } from "@/lib/server";
import { boundedBytes, RequestBodyError } from "@/lib/request-body";
import { uploadListingPhoto, MAX_PHOTO_BYTES } from "@/lib/photo-service";
import { ListingError } from "@/lib/listing-lifecycle";
export const runtime = "nodejs";
export const maxDuration = 60;
let active = 0;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const db = adminDb(),
      bearer = request.headers.get("authorization");
    if (!bearer?.startsWith("Bearer "))
      return NextResponse.json(
        { error: "Sign in first." },
        { status: 401, headers },
      );
    let user;
    try {
      user = await getAuth().verifyIdToken(bearer.slice(7), true);
    } catch {
      return NextResponse.json(
        { error: "Sign in again." },
        { status: 401, headers },
      );
    }
    if (active >= 2)
      return NextResponse.json(
        { error: "Photo checks are busy. Try again shortly." },
        { status: 429, headers },
      );
    active++;
    try {
      const { id } = await params;
      const result = await uploadListingPhoto(
        db,
        getStorage().bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
        user.uid,
        id,
        await boundedBytes(request, MAX_PHOTO_BYTES),
      );
      return NextResponse.json(result, { headers });
    } finally {
      active--;
    }
  } catch (error) {
    if (error instanceof ListingError || error instanceof RequestBodyError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers },
      );
    console.error("Photo processing failed", error);
    return NextResponse.json(
      { error: "Unable to process this photo. Try again." },
      { status: 503, headers },
    );
  }
}
