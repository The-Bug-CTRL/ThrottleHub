import Link from "next/link";
import { FieldPath } from "firebase-admin/firestore";
import { notFound } from "next/navigation";
import { adminDb } from "@/lib/server";
import { DirectoryPost, directoryLabels } from "@/lib/directory";
import { provinces } from "@/lib/marketplace";
import { ContentText } from "@/components/content-text";
export const dynamic = "force-dynamic";
export default async function DirectoryDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Query only public records: private submissions never enter the render payload.
  const result = await adminDb()
    .collection("directoryPosts")
    .where(FieldPath.documentId(), "==", id)
    .where("status", "==", "published")
    .where("country", "==", "ZA")
    .limit(1)
    .get();
  if (result.empty) notFound();
  const post = { ...result.docs[0].data(), id } as DirectoryPost;
  return (
    <section className="wrap section directory-detail">
      <Link href={post.kind === "job" ? "/jobs" : "/entries-services"}>
        Back to {post.kind === "job" ? "jobs" : "entries & services"}
      </Link>
      <div className="eyebrow">
        {directoryLabels[post.kind]} · {post.category}
      </div>
      <h1>{post.title}</h1>
      <p>
        {post.organisation} · {post.city},{" "}
        {provinces[post.region as keyof typeof provinces]}
      </p>
      <ContentText text={post.body} />
      {post.price > 0 && (
        <p>
          <b>R{post.price.toLocaleString("en-ZA")}</b>
        </p>
      )}
      <a
        className="button"
        href={`mailto:${encodeURIComponent(post.contactEmail)}?subject=${encodeURIComponent(post.title)}`}
      >
        Contact advertiser
      </a>
      <p>
        <small>
          Posted {new Date(post.createdAt).toLocaleDateString("en-ZA")}
        </small>
      </p>
    </section>
  );
}
