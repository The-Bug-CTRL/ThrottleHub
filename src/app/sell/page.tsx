import { Suspense } from "react";
import { ListingForm } from "@/components/listing-form";
export default function Page() {
  return (
    <Suspense>
      <ListingForm />
    </Suspense>
  );
}
