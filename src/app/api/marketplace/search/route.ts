import { boundedText, RequestBodyError } from "@/lib/request-body";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server";
import { queryMarketplace } from "@/lib/marketplace-search";
import { ZodError } from "zod";
export async function POST(request: Request) {
  try {
    const text = await boundedText(request, 12000);
    if (text.length > 12000)
      return NextResponse.json(
        { error: "Search request too large." },
        { status: 413 },
      );
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body))
      return NextResponse.json(
        { error: "Invalid search request." },
        { status: 400 },
      );
    const { filters, cursor } = body;
    return NextResponse.json(
      await queryMarketplace(adminDb(), filters, cursor),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof RequestBodyError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    if (error instanceof SyntaxError || error instanceof ZodError)
      return NextResponse.json(
        { error: "Invalid search request." },
        { status: 400 },
      );
    const message =
      error instanceof Error ? error.message : "Search unavailable";
    const index = /index|FAILED_PRECONDITION/i.test(message);
    const expected =
      /Choose|Use one|Invalid|exceeds|only|Search changed|do not apply|Zod/i.test(
        message,
      );
    if (!expected) console.error("Marketplace search:", error);
    return NextResponse.json(
      {
        error: index
          ? "This search requires a configured Firestore index. Ask the administrator to apply the checked-in index catalogue; your filters have not been removed."
          : /Choose|Use one|Invalid|exceeds|only|Search changed|do not apply|Zod/i.test(
                message,
              )
            ? message
            : "Marketplace search is unavailable. Check the local Firebase connection and try again.",
      },
      { status: expected && !index ? 400 : 503 },
    );
  }
}
