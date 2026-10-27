import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/server";
import { importedFeed } from "@/lib/imported-content-server";
export const dynamic = "force-dynamic";
const input = z
  .object({
    cursor: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,200}$/)
      .optional(),
    category: z.string().max(100).optional(),
    search: z.string().max(120).optional(),
    country: z.enum(["za", "international", ""]).optional(),
    province: z.string().max(80).optional(),
    discipline: z.string().max(100).optional(),
    level: z.string().max(80).optional(),
    past: z.enum(["true", "false"]).optional(),
  })
  .strict();
export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const headers = { "Cache-Control": "no-store" };
  const { kind } = await params;
  if (kind !== "news" && kind !== "races" && kind !== "videos")
    return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  const parsed = input.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid filters" },
      { status: 400, headers },
    );
  try {
    return NextResponse.json(
      await importedFeed(adminDb(), kind, {
        ...parsed.data,
        past: parsed.data.past === "true",
      }),
      { headers },
    );
  } catch (error) {
    console.error(
      "Imported content unavailable",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      { error: "Unable to load this feed. Please try again." },
      { status: 503, headers },
    );
  }
}
