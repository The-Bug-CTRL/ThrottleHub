# Imported YouTube content integration

> Historical implementation report. The subsequent [homepage layout update](HOMEPAGE_CONTENT_LAYOUT.md) replaces the grid with Latest Racing Highlights, removes the `/videos` page/navigation, and disables automatic playback. The secure reader and URL validation remain unchanged.

27 October 2026. Firebase target remains `throttlehub-9d6b9`.

## Delivered

- Homepage: **Latest Racing & Videos**, immediately below the Race Calendar and after News, with four eligible recent videos and a **View all videos** link. Existing news/calendar layouts are retained.
- `/videos`: responsive three-column gallery (two columns on tablet, one on mobile), actual stored category choices, bounded pagination, loading/error/retry and empty states. Categories are discovered from eligible records encountered while paging; unsupported categories are not pre-populated or assigned fabricated counts.
- Cards display the approved YouTube thumbnail, play overlay, title, channel, publication date and stored category. Missing/unapproved/failed thumbnails use a ThrottleHub fallback. `next.config.ts` permits only HTTPS `i.ytimg.com/vi/**` thumbnail optimization without query strings.
- Playback opens a native modal with Escape/close controls, focus restoration and scroll locking. No iframe is rendered before the visitor clicks. Valid embeds use `www.youtube-nocookie.com`; an **Open on YouTube** link remains available if embedding is absent, disabled or unavailable. Cross-origin player failures cannot reliably be inspected by the parent, so the fallback link is always present rather than claiming detection of every YouTube playback error. Closing the dialog unmounts the player.

## Data and security

The existing Admin `importedFeed` reader and `/api/content/[kind]` endpoint now support `videos` → `contentVideos`. Only `kind=youtube`, `status=published`, non-hidden documents with a valid 11-character ID, title, date and matching safe YouTube URL are returned. Public fields are explicitly projected; importer moderation metadata, channel identifiers and source-health documents are not returned. Existing `contentSourceHealth` has no public endpoint.

Original URLs must be HTTPS, belong to a supported YouTube host and identify the same video. Links are normalized to the matching official watch URL. Embeds must use the approved privacy-enhanced host and exact matching `/embed/{videoId}` path; query parameters are discarded before adding the UI's playback options. Invalid embeds fall back to the valid original link, never an arbitrary iframe. Thumbnail URLs must exactly match `https://i.ytimg.com/vi/{videoId}/hqdefault.jpg`; other images are not substituted. External links use `noopener noreferrer`.

Reads retain the existing ceiling of 96 documents plus an optional cursor lookup per request, at most 12 eligible displayed results, and a continuation cursor. Categories are refined on the server after the ordered scan. Sparse filters can require another page. `publishedAt` is ordered descending using the importer's stored ISO date strings; consistent ISO UTC formatting is required for that ordering. The normal collection-scoped `contentVideos.publishedAt DESC` single-field index is required; no new composite index is introduced. Cloud exemptions/readiness were not verified.

These are public-safe Admin-backed content readers, like News/Calendar. The private-test application's existing localhost boundary remains relevant; this feature does not make the whole application ready for public hosting. No YouTube API key, Google access token or Admin credential is put in browser code. No video file is downloaded, rehosted or written to Storage. Next.js only optimizes the permitted public thumbnails.

No Functions, deployed or local Firestore/Storage Rules, hosting configuration, AWS resources, listing running-video code, accounts, profiles or messaging were changed by this task. Existing uncommitted changes were preserved. The existing separate `syncDirtBikeVideos` importer and Secret Manager configuration were not accessed or modified.

## Verification

- Full isolated Auth/Firestore/Storage suite: **200 passed, 37 files, exit 0**. Added coverage includes public projections, hidden/draft rejection, unsafe/mismatched IDs and URLs, actual SDK newest-first queries, category filtering, pagination/empty results, thumbnail markup/fallbacks, and no iframe before playback. Existing marketplace/account/media/security tests passed.
- TypeScript: passed. The first attempt encountered development `.next/types` files disappearing during compilation; the subsequent check passed without changing the running development output.
- Isolated production build: passed, exit 0. The user's development `.next` was preserved.
- ESLint: **0 errors, 19 warnings**.
- Evidence: `.tools/youtube-emulator-tests.log`, `.tools/youtube-build.log`, `.tools/youtube-lint.log`.

No live Firestore reads or writes, YouTube playback/browser tests, or interactive mobile tests were performed. The owner previously confirmed that local Admin ADC is not configured; no credentials or keys were created/downloaded. Browser access was previously denied. Responsive CSS and static rendering assertions do not establish actual device playback behavior. Test video documents existed only in isolated `demo-throttlehub-tests`, never in the live database; no demonstration inventory was added.

After approved local Admin authentication is configured, restart `npm run dev` (the image configuration changed), then inspect the homepage and `/videos` at `http://localhost:3000`. Verify genuine latest videos/categories and thumbnails, open/close a player, confirm that YouTube iframe requests begin only on click, try the original link when playback is unavailable, and check narrow/mobile layouts. No Rule deployment or new Functions are required by this feature. Existing private-test/provider/IAM prerequisites from the earlier readiness report still apply.

## Changed files

- New: `src/lib/imported-video.ts`, `src/components/content-videos.tsx`, `src/app/videos/page.tsx`, `tests/imported-video.test.tsx`, `tests/imported-video-integration.test.ts`, this report.
- Extended: `src/lib/imported-content-server.ts`, `src/app/api/content/[kind]/route.ts`, `src/components/imported-feed.tsx`, `src/app/page.tsx`, `src/components/shell.tsx`, `src/app/globals.css`, `next.config.ts`, `vitest.config.ts`, `tests/content-profile-api.test.ts` (video-route assertion only).
