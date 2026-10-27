import { provinces } from "./marketplace";
/** Public projections for externally imported content. Never return raw importer documents. */
export function text(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
export function safeContentUrl(value: unknown): string {
  try {
    const url = new URL(text(value, 2048));
    if (url.protocol !== "https:" || url.username || url.password) return "";
    return url.href;
  } catch {
    return "";
  }
}
export function contentMillis(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    const n = value.toMillis();
    return Number.isFinite(n) ? n : null;
  }
  const n = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(n) ? n : null;
}
export function calendarDate(value: unknown): string {
  const s = text(value, 40);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const d = new Date(`${s}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s
    ? s
    : "";
}
export function displayCalendarDate(value: string): string {
  return calendarDate(value)
    ? new Date(`${value}T12:00:00Z`).toLocaleDateString("en-ZA", {
        timeZone: "UTC",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Date to be confirmed";
}
export function todayZA(now = Date.now()) {
  return new Date(now + 7_200_000).toISOString().slice(0, 10);
}
export function importedNews(id: string, d: Record<string, unknown>) {
  if (d.status !== "published" || d.manuallyHidden === true) return null;
  const title = text(d.title, 300),
    url = safeContentUrl(d.url),
    publishedAt = contentMillis(d.publishedAt);
  if (!title || !url || publishedAt === null) return null;
  return {
    id,
    title,
    url,
    publishedAt,
    summary: text(d.summary, 2000),
    publisher: text(d.publisher, 120),
    category: text(d.category, 100),
    imageUrl: safeContentUrl(d.imageUrl) || null,
  };
}
export function importedRace(id: string, d: Record<string, unknown>) {
  if (d.publicationStatus !== "published" || d.manuallyHidden === true)
    return null;
  const title = text(d.title, 300),
    startDate = calendarDate(d.startDate),
    end = calendarDate(d.endDate);
  if (!title || !startDate) return null;
  return {
    id,
    title,
    startDate,
    endDate: end >= startDate ? end : startDate,
    status: [
      "scheduled",
      "postponed",
      "cancelled",
      "canceled",
      "completed",
      "awaiting confirmation",
      "tbc",
    ].includes(text(d.status, 60).toLowerCase())
      ? text(d.status, 60)
      : "",
    dateStatus: text(d.dateStatus, 80),
    country: text(d.country, 80),
    province: text(d.province, 80),
    city: text(d.city, 120),
    venue: text(d.venue, 200),
    discipline: text(d.discipline, 100),
    level: text(d.level, 80),
    championship: text(d.championship, 200),
    organiser: text(d.organiser, 160),
    sourceUrl: safeContentUrl(d.sourceUrl) || safeContentUrl(d.url),
    registrationUrl: safeContentUrl(d.registrationUrl),
  };
}
export type ImportedNews = NonNullable<ReturnType<typeof importedNews>>;
export type ImportedRace = NonNullable<ReturnType<typeof importedRace>>;
export function isSouthAfrican(country: string) {
  return ["za", "south africa", "south-africa", "zaf"].includes(
    country.toLowerCase(),
  );
}
export function sameFilter(value: string, filter: string) {
  const normalize = (v: string) => {
    const named = provinces[v as keyof typeof provinces] || v;
    const key = named.toLowerCase().replace(/[^a-z0-9]/g, "");
    return (
      (
        {
          mx: "motocross",
          xc: "crosscountry",
          crosscountryracing: "crosscountry",
          offroad: "crosscountry",
          clublevel: "club",
          regionallevel: "regional",
          nationallevel: "national",
        } as Record<string, string>
      )[key] || key
    );
  };
  return !filter || normalize(value) === normalize(filter);
}
