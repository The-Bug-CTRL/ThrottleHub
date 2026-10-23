import { notFound } from "next/navigation";
import Link from "next/link";
import { brand } from "@/lib/config";
const pages: Record<string, [string, string]> = {
  about: [
    "Built around a shared obsession.",
    `${brand.name} connects off-road motorcycle riders through classifieds, mechanical discussions, original editorial content and user-submitted stolen-bike reports. The working brand remains subject to domain and trademark clearance.`,
  ],
  help: [
    "A little help getting started.",
    "Create one account to list an item, save favourites, contact a seller, start a discussion or submit a stolen-bike report. Listings use original currencies and sellers arrange transactions directly. Forum search accepts a single keyword or prefix. Stolen-bike reports are reviewed before public visibility.",
  ],
  contact: [
    "Get in touch.",
    "A public support address has not been configured yet. Signed-in members can use the report action on listings, forum posts and stolen-bike reports to request moderator review. This platform is not an emergency service. Operational support details must be established before public launch.",
  ],
};
export default async function Info({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const p = pages[(await params).page];
  if (!p) notFound();
  return (
    <article className="policy">
      <div className="eyebrow">{brand.name.toUpperCase()}</div>
      <h1>{p[0]}</h1>
      <p>{p[1]}</p>
      <Link href="/auth" className="button">
        Your account
      </Link>{" "}
      <Link href="/policies/rules">Marketplace safety →</Link>
    </article>
  );
}
