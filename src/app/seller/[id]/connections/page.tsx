import Link from "next/link";
import { notFound } from "next/navigation";
import { adminDb } from "@/lib/server";
import { MemberConnections } from "@/components/member-connections";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Rider connections",
  robots: { index: false, follow: true },
};
export default async function Connections({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) notFound();
  const profile = await adminDb().collection("profiles").doc(id).get();
  if (!profile.exists) notFound();
  const direction =
    (await searchParams).tab === "following" ? "following" : "followers";
  return (
    <section className="wrap section">
      <Link href={`/seller/${id}`}>
        Back to {profile.data()!.displayName}&apos;s profile
      </Link>
      <h1>Rider connections</h1>
      <nav className="connection-tabs" aria-label="Rider connections">
        <Link
          href={`/seller/${id}/connections?tab=followers`}
          aria-current={direction === "followers" ? "page" : undefined}
        >
          Followers
        </Link>
        <Link
          href={`/seller/${id}/connections?tab=following`}
          aria-current={direction === "following" ? "page" : undefined}
        >
          Following
        </Link>
      </nav>
      <MemberConnections
        key={`${id}-${direction}`}
        uid={id}
        direction={direction}
      />
    </section>
  );
}
