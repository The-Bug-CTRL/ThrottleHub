import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { ZodError } from "zod";
import { adminDb } from "@/lib/server";
import { ensureProfile, editProfile } from "@/lib/profile-service";
import { ListingError } from "@/lib/listing-lifecycle";
import { boundedText, RequestBodyError } from "@/lib/request-body";
export const dynamic = "force-dynamic";
async function handle(request: Request, edit = false) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const db = adminDb(),
      header = request.headers.get("authorization");
    if (!header?.startsWith("Bearer "))
      throw new ListingError("Sign in first.", 401);
    let identity;
    try {
      identity = await getAuth().verifyIdToken(header.slice(7), true);
    } catch {
      throw new ListingError("Sign in again.", 401);
    }
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      throw new ListingError("Invalid request origin.", 403);
    let input: unknown = {};
    if (request.method !== "GET") {
      try {
        input = JSON.parse(await boundedText(request, 12000));
      } catch (e) {
        if (e instanceof RequestBodyError) throw e;
        throw new ListingError("Invalid profile request.", 400);
      }
    }
    return NextResponse.json(
      await (edit
        ? editProfile(db, identity.uid, input)
        : ensureProfile(db, identity.uid, input)),
      { headers },
    );
  } catch (error) {
    const status =
      error instanceof ListingError || error instanceof RequestBodyError
        ? error.status
        : error instanceof ZodError
          ? 400
          : 503;
    const message =
      error instanceof ListingError || error instanceof RequestBodyError
        ? error.message
        : error instanceof ZodError
          ? error.issues[0]?.message || "Check your profile details."
          : "You are signed in, but your profile could not be loaded or saved. Check the server's Firebase connection, then retry account setup. You do not need to create another account.";
    return NextResponse.json({ error: message }, { status, headers });
  }
}
export const GET = (request: Request) => handle(request);
export const POST = (request: Request) => handle(request);
export const PATCH = (request: Request) => handle(request, true);
