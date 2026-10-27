"use client";

import { useEffect, useState } from "react";

export function ListingAge({ publishedAt }: { publishedAt?: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  if (!publishedAt || !Number.isFinite(publishedAt)) return null;
  const days = Math.max(0, Math.floor(((now ?? publishedAt) - publishedAt) / 86_400_000));
  const date = new Date(publishedAt);
  return (
    <time dateTime={date.toISOString()} title={`First listed ${date.toLocaleDateString("en-ZA")}`}>
      {now === null
        ? `Listed ${date.toLocaleDateString("en-ZA")}`
        : days === 0
          ? "Listed today"
          : `Listed ${days} ${days === 1 ? "day" : "days"} ago`}
    </time>
  );
}
