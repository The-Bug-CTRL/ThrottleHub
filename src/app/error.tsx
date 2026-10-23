"use client";
import { dataError } from "@/lib/errors";
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <section className="wrap section">
      <h1>We couldn’t load this page.</h1>
      <p className="notice error" role="alert">
        {dataError(error)}
      </p>
      <p>No substitute content has been shown.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
