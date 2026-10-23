import { LoadingState } from "@/components/ui/primitives";
export default function Loading() {
  return (
    <section className="wrap section page-loading">
      <LoadingState size={192} label="Loading ThrottleHub…" />
    </section>
  );
}
