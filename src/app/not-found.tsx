import Link from "next/link";
export default function NotFound() {
  return (
    <div className="auth-panel">
      <h1>This trail ends here.</h1>
      <p>The listing or page is unavailable.</p>
      <Link href="/browse" className="button">
        Back to the marketplace
      </Link>
    </div>
  );
}
