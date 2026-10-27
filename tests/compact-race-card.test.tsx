import { it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CompactRaceCard,
  ImportedRaceCard,
} from "../src/components/imported-feed";
import type { ImportedRace } from "../src/lib/imported-content";
const race: ImportedRace = {
  id: "race",
  title:
    "A very long official regional motorcycle championship event name that remains available in full",
  startDate: "2026-11-01",
  endDate: "2026-11-02",
  status: "postponed",
  dateStatus: "provisional",
  country: "ZA",
  province: "Gauteng",
  city: "",
  venue: "Official venue",
  discipline: "Motocross",
  level: "Regional",
  championship: "Championship",
  organiser: "Organiser details",
  sourceUrl: "https://example.com/event",
  registrationUrl: "",
};
it("keeps the full title accessible and shows real dates, compact metadata, location and exceptional status", () => {
  const html = renderToStaticMarkup(<CompactRaceCard event={race} />);
  expect(html).toContain(`title="${race.title}"`);
  expect(html).toMatch(/datetime="2026-11-01"/i);
  for (const text of [
    race.title,
    "Official venue",
    "Gauteng",
    "Motocross",
    "Regional",
    "postponed",
    "provisional",
    "Official event",
  ])
    expect(html).toContain(text);
  expect(html).toContain('rel="noopener noreferrer"');
  expect(html).not.toContain("Organiser details");
  expect(html).not.toContain("event-date");
});
it("omits missing locations, ordinary scheduled status and unavailable links without inventing details", () => {
  const html = renderToStaticMarkup(
    <CompactRaceCard
      event={{
        ...race,
        venue: "",
        province: "",
        status: "scheduled",
        dateStatus: "confirmed",
        sourceUrl: "",
        registrationUrl: "",
      }}
    />,
  );
  for (const text of [
    "null",
    "undefined",
    "scheduled",
    "confirmed",
    "Location to be confirmed",
    "Official event",
  ])
    expect(html).not.toContain(text);
  expect(html).toContain(`title="${race.title}"`);
});
it("preserves the full Events-page card, including organiser and registration information", () => {
  const html = renderToStaticMarkup(
    <ImportedRaceCard
      event={{ ...race, registrationUrl: "https://example.com/entry" }}
    />,
  );
  expect(html).toContain("Organiser details");
  expect(html).toContain("Registration");
  expect(html).toContain("postponed");
  expect(html).not.toContain("compact-race-card");
});
