import { NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server";
import { reviewSummary } from "@/lib/reviews";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id || id.length > 128 || id.includes("/"))
    return NextResponse.json({ error: "Invalid profile." }, { status: 400 });
  try {
    const collection = adminDb()
      .collection("profiles")
      .doc(id)
      .collection("reviews");
    const published = collection.where("status", "==", "published");
    const url = new URL(request.url),
      after = url.searchParams.get("after");
    let query = published
      .orderBy("createdAt", "desc")
      .orderBy(FieldPath.documentId(), "desc")
      .limit(21);
    if (after) {
      if (after.includes("/") || after.length > 128)
        return NextResponse.json(
          { error: "Invalid review cursor." },
          { status: 400 },
        );
      const cursor = await collection.doc(after).get();
      if (!cursor.exists)
        return NextResponse.json(
          { error: "Review cursor expired. Refresh this page." },
          { status: 400 },
        );
      query = query.startAfter(cursor);
    }
    const [counts, page] = await Promise.all([
      Promise.all(
        [1, 2, 3, 4, 5].map((rating) =>
          published.where("rating", "==", rating).count().get(),
        ),
      ),
      url.searchParams.get("summary") === "1"
        ? Promise.resolve(null)
        : query.get(),
    ]);
    const docs = page?.docs.slice(0, 20) || [];
    return NextResponse.json(
      {
        summary: reviewSummary(counts.map((result) => result.data().count)),
        reviews: docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            authorId: d.authorId,
            authorName: d.authorName,
            subjectId: id,
            listingId: d.listingId,
            listingTitle: d.listingTitle,
            role: d.role,
            rating: d.rating,
            body: d.body,
            status: d.status,
            createdAt: d.createdAt.toMillis(),
            updatedAt: d.updatedAt.toMillis(),
            response: d.response,
          };
        }),
        next: page && page.docs.length > 20 ? docs.at(-1)?.id : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Profile reviews unavailable:", error);
    return NextResponse.json(
      { error: "Reviews are unavailable. Please try again." },
      { status: 503 },
    );
  }
}
