import Link from "next/link";
export const metadata = {
  title: "Listing unavailable",
  robots: { index: false, follow: false },
};
export default function ListingNotFound() {
  return (
    <section className="wrap section">
      <h1>This advert is unavailable.</h1>
      <p>
        It may have been removed or restricted. Sold, expired and on-hold
        adverts remain available unless removed.
      </p>
      <Link className="button" href="/browse">
        Browse the marketplace
      </Link>
    </section>
  );
}
