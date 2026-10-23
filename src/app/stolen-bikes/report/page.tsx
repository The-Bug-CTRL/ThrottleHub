import { Suspense } from "react";
import { StolenForm } from "@/components/stolen";
export const metadata = { title: "Report a stolen motorcycle" };
export default function Page() {
  return (
    <Suspense>
      <StolenForm />
    </Suspense>
  );
}
