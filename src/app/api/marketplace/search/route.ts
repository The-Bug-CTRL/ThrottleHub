import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server";
import { queryMarketplace } from "@/lib/marketplace-search";
export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length > 12000)
      return NextResponse.json(
        { error: "Search request too large." },
        { status: 413 },
      );
    const { filters, cursor } = JSON.parse(text);
    return NextResponse.json(
      await queryMarketplace(adminDb(), filters, cursor),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
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
      { status: 400 },
    );
  }
}
