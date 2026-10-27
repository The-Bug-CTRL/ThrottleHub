import { NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { getListing } from "@/lib/server";
import { videoIsReady } from "@/lib/running-video";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const listing = await getListing(id);
    if (!listing || !videoIsReady(listing.runningVideo, listing.ownerId, id))
      return new NextResponse("Video unavailable", { status: 404 });
    const bucket = getStorage().bucket(
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      ),
      file = bucket.file(listing.runningVideo.path, {
        generation: listing.runningVideo.generation,
      });
    const [metadata] = await file.getMetadata();
    // Only return a bearer playback capability after the public listing guard.
    const { getDownloadURL } = await import("firebase-admin/storage");
    const token = String(
      metadata.metadata?.firebaseStorageDownloadTokens || "",
    );
    if (!token)
      return new NextResponse("Video playback is not configured", {
        status: 503,
      });
    return NextResponse.redirect(await getDownloadURL(file), {
      status: 307,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return new NextResponse("Video temporarily unavailable", { status: 503 });
  }
}
