import { notFound, permanentRedirect } from "next/navigation";
import { getListing, getPublicListings } from "@/lib/server";
import { ListingDetail } from "@/components/detail";
import { isHistorical, listingHref, statusLabel } from "@/lib/listing-history";
import { brand } from "@/lib/config";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const l = await getListing((await params).id);
  return {
    title: l
      ? `${l.title}${isHistorical(l) ? ` — ${statusLabel(l.status)}` : ""}`
      : "Listing unavailable",
    description: l?.description.slice(0, 150),
    alternates: { canonical: l ? listingHref(l) : undefined },
    ...(l ? {} : { robots: { index: false, follow: false } }),
    openGraph: {
      title: l
        ? `${l.title} — ${statusLabel(l.status)}`
        : "Listing unavailable",
      description: l?.description.slice(0, 150),
      images: l?.images.slice(0, 1),
    },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { id, slug } = await params;
  const l = await getListing(id);
  if (!l) notFound();
  if (slug !== (l.slug || "item")) permanentRedirect(listingHref(l));
  const similar = (await getPublicListings(l.category))
    .filter((item) => item.id !== l.id)
    .slice(0, 4);
  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: l.title,
    description: l.description,
    image: l.images,
    sku: l.id,
    ...(l.make ? { brand: { "@type": "Brand", name: l.make } } : {}),
    offers: {
      "@type": "Offer",
      price: l.price,
      priceCurrency: l.currency,
      url: brand.domain + listingHref(l),
      availability: `https://schema.org/${l.status === "published" ? "InStock" : l.status === "sold" ? "SoldOut" : "OutOfStock"}`,
      description: "Advertised asking price; not a verified transaction price.",
    },
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(product).replace(/</g, "\\u003c"),
        }}
      />
      <ListingDetail listing={l} similar={similar} />
    </>
  );
}
