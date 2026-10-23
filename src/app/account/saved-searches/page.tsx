import { SavedSearches } from "@/components/saved-searches";
import Link from "next/link";
export default function Page() {
  return (
    <section className="wrap section">
      <Link href="/account">← My garage</Link>
      <h1>Saved searches</h1>
      <SavedSearches />
    </section>
  );
}
