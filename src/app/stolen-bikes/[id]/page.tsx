import { notFound } from "next/navigation";
import { publicDocument } from "@/lib/server";
import { StolenReport } from "@/lib/community-models";
import { StolenDetail } from "@/components/stolen";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const r = (await publicDocument("stolenReports", (await params).id, [
    "published",
    "recovered",
  ])) as StolenReport | null;
  return {
    title: r
      ? `${r.make} ${r.model} — ${r.status === "recovered" ? "Recovered" : "Reported stolen"}`
      : "Report unavailable",
    description: r
      ? `User-submitted motorcycle report in ${r.city}, ${r.country}.`
      : undefined,
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const r = await publicDocument("stolenReports", (await params).id, [
    "published",
    "recovered",
  ]);
  if (!r) notFound();
  return <StolenDetail report={r as StolenReport} />;
}
