import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/server";
import { boundedText, RequestBodyError } from "@/lib/request-body";
import { ListingError } from "@/lib/listing-lifecycle";
import {
  recordEngagement,
  engagementEvents,
  type EngagementEvent,
} from "@/lib/listing-engagement";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    if (
      request.headers.get("origin") &&
      request.headers.get("origin") !== request.nextUrl.origin
    )
      throw new ListingError("Invalid request origin.", 403);
    const db = adminDb(),
      bearer = request.headers.get("authorization");
    let uid: string | undefined;
    if (bearer) {
      try {
        uid = (
          await getAuth().verifyIdToken(bearer.replace(/^Bearer /, ""), true)
        ).uid;
      } catch {
        throw new ListingError("Sign in again.", 401);
      }
    }
    let input;
    try {
      input = JSON.parse(await boundedText(request, 1000));
    } catch (error) {
      if (error instanceof RequestBodyError) throw error;
      throw new ListingError("Invalid interaction.");
    }
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      Object.keys(input).length !== 1 ||
      !engagementEvents.includes(input.event)
    )
      throw new ListingError("Invalid interaction.");
    const old = request.cookies.get("throttlehub-visitor")?.value;
    const visitor = old && /^[a-f0-9-]{36}$/.test(old) ? old : randomUUID();
    const result = await recordEngagement(
      db,
      (await params).id,
      input.event as EngagementEvent,
      uid ? "uid:" + uid : "browser:" + visitor,
      uid,
    );
    const response = NextResponse.json(
      input.event === "phone" ? { phone: result.phone } : { ok: true },
      { headers },
    );
    if (!uid && visitor !== old)
      response.cookies.set("throttlehub-visitor", visitor, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 2592000,
      });
    return response;
  } catch (error) {
    if (error instanceof ListingError || error instanceof RequestBodyError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers },
      );
    return NextResponse.json(
      { error: "Unable to record this interaction." },
      { status: 503, headers },
    );
  }
}
