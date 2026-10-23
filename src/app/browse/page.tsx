import { LoadingState } from "@/components/ui/primitives";
import { Suspense } from "react";
import { Browse } from "@/components/browse";
export const metadata = {
  title: "Explore the South African marketplace",
  robots: { index: false, follow: true },
  alternates: { canonical: "/browse" },
};
export default function Page() {
  return (
    <Suspense
      fallback={
        <section className="wrap section">
          <LoadingState size={144} label="Loading marketplace…" />
        </section>
      }
    >
      <Browse />
    </Suspense>
  );
}
