import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server";
import { publicProfile } from "@/lib/profile-service";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id))
    return NextResponse.json({ error: "Invalid profile." }, { status: 400 });
  try {
    const snapshot = await adminDb().doc(`profiles/${id}`).get();
    return NextResponse.json({ profile: snapshot.exists ? publicProfile(snapshot.data()!) : null }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load this profile." }, { status: 503 });
  }
}
