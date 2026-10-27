# Homepage racing carousel and compact calendar

27 October 2026. Focused frontend update; no deployment or cloud changes.

## Changes

- **Latest Racing Highlights** now appears after the News and Race Calendar sections. It displays up to 12 recent eligible imported videos using the existing bounded server Admin reader. No importer, query validation or public field projection was changed.
- Horizontal scroll-snap carousel shows approximately three cards on desktop, two on tablet and one on mobile. Chevron controls move one card at a time; touch scrolling is native. Left/Right and Home/End work on the focusable track, with labelled controls, slide positions and full-title buttons. Focused cards scroll into view. Reduced-motion preference disables animated navigation. There are no automatic timers or automatic slide movement.
- Lightweight cards retain actual 16:9 YouTube thumbnails, a small play overlay, a two-line title and channel/category metadata. Missing/failed thumbnails retain the branded fallback. There are no publication-date blocks or additional card action rows.
- Clicking opens the existing privacy-enhanced player dialog. No iframe exists before a click, and the modal no longer requests autoplay. Original YouTube links remain available inside the modal if embedding is missing/disabled. Escape, close, focus restoration and scroll locking remain.
- A section-level Suspense loading state streams while video content is read. Errors and no eligible records show their existing appropriate states; zero records do not render an empty carousel.
- Removed the previously added **`/videos` page** and **Videos navigation item**. No replacement page or video navigation link was introduced.
- Homepage-only compact race cards use a three/two/one-column responsive layout, roughly 210px minimum desktop height where content permits, smaller dates/headings and reduced padding. Full titles remain in the DOM, title tooltip and official source link. Cards retain date ranges, discipline/level, available venue/province and unobtrusive exceptional status such as postponed/cancelled. Ordinary scheduled/confirmed labels and organiser paragraphs are omitted from the homepage summary. No date sidebar remains.
- The full Events page/card, its fields, historical view and filters are unchanged. News cards/layout are unchanged. Profiles, listings, running-video uploads, messaging, favourites, Firebase Rules, Functions, image configuration and hosting configuration were not edited by this update. Existing uncommitted work was preserved.

## Validation

TypeScript source/test checking passes using `.tools/home-layout-typecheck.json`; this excludes stale generated `.next` validators from the removed `/videos` route. The fresh isolated Next.js production build also passes with its own generated route types, exit 0. The running development `.next` directory was not deleted or rebuilt. Restart the development server to refresh its route inventory; stale generated route validators can affect a root typecheck until that cache is refreshed.

Full isolated emulator/application regression suite: **204 passed across 38 files, exit 0**. ESLint: 0 errors, 19 warnings. Automated coverage includes actual emulator video queries for eligibility/order/filtering, unsafe URLs/IDs, thumbnail fallbacks, absence of an iframe before clicking, non-autoplay modal rendering, empty carousel output, labelled keyboard controls, and compact/full race-card rendering with long titles and exceptional status. Results are recorded in `.tools/home-layout-tests.log`; build/lint evidence is in `.tools/home-layout-build.log` and `.tools/home-layout-lint.log`.

Live Firestore reads, interactive YouTube playback, actual swipe/arrow/keyboard interaction, and device screenshots were not performed. Local Admin credentials remain unconfigured as previously confirmed by the owner, and browser access was previously denied. Static rendering and responsive CSS are not represented as browser/device acceptance. No synthetic inventory was written to the live project; test records are isolated to loopback `demo-throttlehub-tests`.

## Files

- `src/components/content-videos.tsx`: minimal cards, carousel, manual playback.
- `src/components/imported-feed.tsx`: added homepage-only `CompactRaceCard`; full cards retained.
- `src/app/page.tsx`: compact calendar, streamed racing carousel and new heading.
- `src/app/globals.css`: scoped carousel and compact-card styles/breakpoints.
- `src/components/shell.tsx`: removed Videos navigation item.
- Removed `src/app/videos/page.tsx`.
- `tests/imported-video.test.tsx`, new `tests/compact-race-card.test.tsx`: rendering regressions.
- This report and the supersession notice in `YOUTUBE_CONTENT_INTEGRATION.md`.
