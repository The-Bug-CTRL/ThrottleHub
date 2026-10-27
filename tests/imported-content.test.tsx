import { it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  importedNews,
  importedRace,
  calendarDate,
  displayCalendarDate,
  safeContentUrl,
  sameFilter,
  todayZA,
} from "../src/lib/imported-content";
import {
  ImportedArticleCard,
  ImportedRaceCard,
} from "../src/components/imported-feed";
it("projects published news only, strips importer metadata and handles nullable images", () => {
  const raw = {
    title: "Source headline",
    summary: "Source summary",
    publisher: "Publisher",
    url: "https://example.com/news",
    publishedAt: { toMillis: () => 1234567890000 },
    status: "published",
    imageUrl: null,
    contentHash: "private",
    editorLocked: true,
  };
  expect(importedNews("a", raw)).toEqual({
    id: "a",
    title: raw.title,
    summary: raw.summary,
    publisher: raw.publisher,
    url: raw.url,
    publishedAt: 1234567890000,
    imageUrl: null,
    category: "",
  });
  expect(importedNews("a", { ...raw, status: "draft" })).toBeNull();
  expect(importedNews("a", { ...raw, manuallyHidden: true })).toBeNull();
  expect(importedNews("a", { ...raw, url: "javascript:alert(1)" })).toBeNull();
  const html = renderToStaticMarkup(
    <ImportedArticleCard article={importedNews("a", raw)!} />,
  );
  expect(html).toContain("ThrottleHub");
  expect(html).toContain('rel="noopener noreferrer"');
  expect(html).not.toContain("private");
  expect(html).not.toContain("<img");
});
it("rejects unsafe source and thumbnail URLs", () => {
  for (const value of [
    null,
    "http://example.com",
    "javascript:alert(1)",
    "data:image/svg+xml,hi",
    "https://name:password@example.com",
  ])
    expect(safeContentUrl(value)).toBe("");
  expect(safeContentUrl("https://example.com/a")).toBe("https://example.com/a");
});
it("uses calendar dates even if dateOnly is false, rejects rolled dates and never invents a live time", () => {
  expect(calendarDate("2026-02-30")).toBe("");
  expect(calendarDate("2026-10-27")).toBe("2026-10-27");
  expect(calendarDate("2026-10-27T00:00:00Z")).toBe("");
  expect(displayCalendarDate("2026-10-27")).toContain("27");
  expect(todayZA(Date.parse("2026-10-26T22:30:00Z"))).toBe("2026-10-27");
  const raw = {
    title: "Official race",
    startDate: "2026-10-27",
    endDate: null,
    dateOnly: false,
    publicationStatus: "published",
    country: "ZA",
    city: null,
    championship: null,
    status: "live",
    sourceUrl: "https://example.com/calendar",
    contentHash: "internal",
  };
  const race = importedRace("r", raw)!;
  expect(race.endDate).toBe("2026-10-27");
  expect(race.status).toBe("");
  const html = renderToStaticMarkup(<ImportedRaceCard event={race} />);
  for (const value of ["null", "undefined", "Live", "internal", "00:00"])
    expect(html).not.toContain(value);
  expect(importedRace("r", { ...raw, publicationStatus: "draft" })).toBeNull();
  expect(importedRace("r", { ...raw, manuallyHidden: true })).toBeNull();
  expect(importedRace("r", { ...raw, status: "cancelled" })?.status).toBe(
    "cancelled",
  );
});
it("matches common official calendar province and discipline labels", () => {
  expect(sameFilter("ZA-GP", "Gauteng")).toBe(true);
  expect(sameFilter("MX", "Motocross")).toBe(true);
  expect(sameFilter("cross_country", "Cross-country")).toBe(true);
  expect(sameFilter("Club", "Regional")).toBe(false);
});
