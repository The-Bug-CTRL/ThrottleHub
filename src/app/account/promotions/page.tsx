import {
  PromotionCallback,
  PromotionHistory,
} from "@/components/promote-listing";
export const metadata = { title: "Verify promotion payment" };
export default function Page() {
  return (
    <section className="wrap section">
      <h1>Promotion payment</h1>
      <p>
        <a href="/help">Need help with a payment or promotion?</a>
      </p>
      <PromotionCallback />
      <PromotionHistory />
    </section>
  );
}
