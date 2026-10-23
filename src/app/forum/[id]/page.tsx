import { notFound } from "next/navigation";
import { publicDocument } from "@/lib/server";
import { Thread } from "@/lib/community-models";
import { ThreadPage } from "@/components/forum";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = (await publicDocument(
    "forumThreads",
    (await params).id,
  )) as Thread | null;
  return {
    title: t?.title || "Discussion unavailable",
    description: t?.body.slice(0, 150),
    alternates: { canonical: t ? `/forum/${t.id}` : undefined },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await publicDocument("forumThreads", (await params).id);
  if (!t) notFound();
  return <ThreadPage thread={t as Thread} />;
}
