import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { adminDb } from "@/lib/server";
import { boundedText, RequestBodyError } from "@/lib/request-body";
import { ListingError } from "@/lib/listing-lifecycle";
import { videoAction } from "@/lib/video-service";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const db = adminDb(),
      bearer = request.headers.get("authorization");
    if (!bearer?.startsWith("Bearer "))
      return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    let token;
    try {
      token = await getAuth().verifyIdToken(bearer.slice(7), true);
    } catch {
      return NextResponse.json({ error: "Sign in again." }, { status: 401 });
    }
    const input = JSON.parse(await boundedText(request, 2000));
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new ListingError("Invalid request.");
    const { id } = await params;
    const result = await videoAction(
      db,
      getStorage().bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
      token.uid,
      id,
      input,
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof ListingError || error instanceof RequestBodyError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    if (error instanceof SyntaxError)
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    console.error("Video validation failed", error);
    return NextResponse.json(
      {
        error:
          "Video could not be accepted. Use a playable 15–60 second H.264 MP4 at 720p or below, with AAC sound for petrol bikes. The server also needs FFmpeg/ffprobe installed. Start a new upload to retry.",
      },
      { status: 422 },
    );
  }
}
