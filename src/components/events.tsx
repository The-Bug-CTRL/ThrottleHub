"use client";
import Link from "next/link";
import { useState } from "react";
import { provinces } from "@/lib/marketplace";
import type { ImportedRace } from "@/lib/imported-content";
import { useImportedFeed, ImportedRaceCard, FeedState } from "./imported-feed";
export function Events() {
  const [country, setCountry] = useState("za"),
    [province, setProvince] = useState(""),
    [discipline, setDiscipline] = useState(""),
    [level, setLevel] = useState(""),
    [past, setPast] = useState(false);
  const feed = useImportedFeed<ImportedRace>("races", {
    country,
    province,
    discipline,
    level,
    past: String(past),
  });
  return (
    <section className="wrap section">
      <div className="eyebrow">RIDING TOGETHER</div>
      <h1>A date with the dirt.</h1>
      <p>
        Race dates from official calendars. Check the official source before
        travelling.
      </p>
      <div className="inline-search">
        <select
          aria-label="Country"
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            setProvince("");
          }}
        >
          <option value="za">South African events</option>
          <option value="">All events</option>
          <option value="international">International events</option>
        </select>
        <select
          aria-label="Province"
          value={province}
          onChange={(e) => setProvince(e.target.value)}
        >
          <option value="">All provinces</option>
          {Object.entries(provinces).map(([key, name]) => (
            <option key={key} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Discipline"
          value={discipline}
          onChange={(e) => setDiscipline(e.target.value)}
        >
          <option value="">All disciplines</option>
          {[
            "Motocross",
            "Enduro",
            "Cross-country",
            "Trials",
            "Supermoto",
            "Road racing",
            "Off-road",
            "Other",
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          aria-label="Race level"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        >
          <option value="">All levels</option>
          {["National", "Regional", "Club", "International"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <button aria-pressed={past} onClick={() => setPast(!past)}>
          {past ? "Show upcoming events" : "Show past events"}
        </button>
      </div>
      <div className="article-grid">
        {feed.items.map((e) => (
          <ImportedRaceCard key={e.id} event={e} />
        ))}
      </div>
      <FeedState feed={feed} label="events" />
      <Link className="text-button" href="/admin/events">
        Events workspace
      </Link>
    </section>
  );
}
