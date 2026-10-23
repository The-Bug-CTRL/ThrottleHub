# ThrottleHub V2 verification - 22 October 2026

The current marketplace implementation and limitations are documented in [MARKETPLACE_V2.md](MARKETPLACE_V2.md). The results below supersede the historical V1.5 results retained later in this file.

| Check | Actual result |
| --- | --- |
| Strict TypeScript | Passed |
| ESLint | 0 errors, 18 warnings in existing native-image/effect patterns |
| Production build | Passed; category route, saved-search page, search API and category middleware included |
| Unit/configuration/design/category tests | 25 passed; the emulator query test is skipped by the ordinary unit command |
| Full isolated Firebase suite | 48 passed across 7 files, including 21 Rules tests, Auth/Firestore/Storage journey and actual marketplace query test |
| Local startup | start-dev.bat started the empty everyday emulators and Next.js successfully |
| Public/gated HTTP checks | 15 routes returned 200; gated routes show their access gate |
| Category route checks | Deep parts and GPS-watch paths, breadcrumbs, canonical metadata, local noindex and invalid-category HTTP 404 passed |
| Search HTTP checks | Four valid empty-market searches returned 200 with zero items; foreign country, multiple words and invalid category returned 400 |
| Branding | Served header contains the original custom PNG image and homepage link; no worldwide action |
| Everyday project integrity | Read-only checks: zero Auth accounts and zero records in listings, profiles, forumThreads, newsArticles, stolenReports and events |
| Browser automation | No apps/browsers connected; interactive viewport, keyboard, touch, focus and visual checks remain unverified |

The 48-test suite ran only against demo-throttlehub-tests on isolated ports. It exercises all prior ownership, messaging, forum, editorial, event and stolen-report boundaries. New tests cover category paths/children, engine-specific categories, make/model contracts, parent/leaf predicates, independent seller fitment years, gear sizes, normalized towns, draft validation, ZA/ZAR/province enforcement, forged paths, foreign-record preservation, saved-search privacy/deletion and notification denial. The real Firestore query test creates temporary isolated records, verifies tied-sort pagination without duplicates, sparse 128-candidate continuation, compound fitment filters, keyword plus category filtering, sibling exclusion and changed-filter cursor rejection, then cleans up.

HTTP 200 routes: /, /browse, /marketplace/motorcycles, /marketplace/parts/engine/top-end/cylinder-heads, /marketplace/electronics/watches-wearables/gps-watches, /account/saved-searches, /auth, /sell, /account, /messages, /forum, /news, /stolen-bikes, /events, /admin. No successful authenticated browser form submission is inferred from these responses. Backend Rules/SDK tests provide the authenticated evidence. The local Admin SDK emitted its known metadata-detection warning; the read-only counts succeeded. No production Firebase credentials or data were used.

The first invalid-category HTTP check caught Next.js streaming a not-found view with status 200. A category-scoped middleware now rejects invalid/inactive paths before streaming; the repeated check returned 404 and has a unit regression check. The first Rules run caught an expression-budget limit; generated checks now select a small category branch and the final suite passes.

Remaining verification: browser selling/editing, saved-search interactions, responsive category drill-down, focus/keyboard and image workflows; deployed composite-index coverage in an explicitly authorised non-production staging project. Local indexes are generated for the actual marketplace candidate query shapes, but the emulator cannot prove staging index enforcement. Search is single-prefix and bounded server refinement, with honest empty-page continuation; email/push delivery is not configured. Existing ZA listings need owner-reviewed category backfill to appear in descendant queries; foreign records were not deleted or rewritten.

Owned local web/emulator processes were stopped after QA. Start again with .\start-dev.bat. No Git initialisation, deployment, production connection or public fixtures were introduced.

---

# ThrottleHub V1.5 verification — 21 October 2026

## Dirt & Stone UI redesign — latest verification

The redesigned application passes strict TypeScript and a production build (23 static pages plus dynamic public content routes). ESLint has **0 errors and 19 warnings**, primarily native Storage image elements and deliberate load-effect dependency patterns. The complete isolated emulator run passes **32 tests across 5 files**: 15 unit/configuration/design tests, 16 Rules tests and 1 multi-service integration journey. Six new checks verify WCAG AA contrast for primary buttons, body text, muted text on off-white/stone, brand links and the white-on-charcoal header.

The new Manrope variable font is bundled locally via next/font/local with its OFL licence. The shell, homepage, filters, cards, gallery, selling/review/success, auth/reset, account/profile, messaging, community/editorial, stolen reports, events and admin navigation use the new system. Security Rules and existing content contracts were not replaced; model-year query indexes are additive. Inbox previews/unread indicators use existing participant messages/readAt.

Built-app HTTP checks additionally confirmed the Manrope file returns **200 / font/ttf**, the generated CSS includes the selected Dirt Brown/Stone tokens, and the homepage includes the charcoal-shell markup, skip link and real empty state without demonstration asset references. Eight primary routes were rechecked against the production server and returned 200. These are asset/application checks, not screenshots.

The app ran through the one-command empty-emulator startup. **18 routes returned HTTP 200**: home, browse, auth, sell, account, messages, forum, new discussion, news, stolen directory/report, events, listing moderation, community moderation, article/event editors, about and privacy. Gated routes return their access gate, not privileged data. Read-only checks still showed zero accounts and content in the everyday project after isolated tests.

Browser discovery again returned no apps/browsers. There are **no claimed screenshots, viewport measurements, client-console checks or verified browser form/focus/touch journeys**. UI_REVIEW.md records the unverified 375/430/768/1366/1920px matrix and the manual journeys still required. HTTP/build/backend tests do not prove visual polish or interaction correctness.

The V1.5 backend results below are retained as the prior implementation baseline; the counts above supersede its old totals for the redesigned version.

## Final results

| Check                              | Observed result                                                                                                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript strict checking         | Passed                                                                                                                                                                  |
| ESLint                             | Passed: 0 errors, 15 warnings (native image elements and explicit loading/submit effect dependencies)                                                                   |
| Production build                   | Passed: Next.js 15.5.28, 23 static pages plus dynamic homepage/listing/profile/thread/article/report/event/info routes                                                  |
| Unit/configuration tests           | 9 passed                                                                                                                                                                |
| Firestore Rules tests              | 16 passed                                                                                                                                                               |
| Auth/Firestore/Storage integration | 1 passed with temporary users, images and records; automatic cleanup                                                                                                    |
| Complete isolated emulator suite   | **26 passed, 4 test files**                                                                                                                                             |
| One-command Windows startup        | Passed: Firebase readiness followed by Next; no seed step                                                                                                               |
| Empty everyday project             | Read-only checks confirmed 0 listings, profiles, threads, articles, stolen reports, events and Auth accounts                                                            |
| Navigation HTTP checks             | 14 routes returned 200                                                                                                                                                  |
| Source cleanup                     | No former brand, seed command, fixed account, fixture imports or obsolete preview flags in active source/scripts/tests; public assets contain only neutral no-photo.svg |
| Homepage HTML                      | Correct brand and intentional zero-listing/forum/news states; no old inventory links or demonstration asset references                                                  |
| Browser automation                 | Inventory returned no apps/browsers; interactive desktop/mobile QA unavailable                                                                                          |

## What the tests exercise

Marketplace public/draft visibility, unauthorised edits and ownership transfer, profile privilege/email injection, private messaging, sender spoofing, immutable participants, buyer-to-self denial and transaction-based creation of a first conversation.

Forum owner edits, immutable identity, mandatory atomic cooldown, rapid-post denial, locked-topic replies, ordinary-user lock denial, moderator restrictions and self-unrestriction denial.

Editorial draft/public separation; ordinary members and moderators denied official publishing; admins allowed. Event draft protection and admin-only publication.

Stolen pending/public separation, owner/moderator evidence access, other-member denial, blocked self-publication and public evidence-field injection, moderation approval, owner recovery, denial of unreviewed public-content replacement and private tips isolation.

Actual SDK integration registers temporary users with random test credentials, signs out/in, creates profiles/drafts, uploads an image, rejects wrong-owner paths and non-image uploads, publishes/edits a listing, saves a favourite, starts a seller conversation transaction and sends a message. It uploads restricted evidence, verifies owner getBytes access and denies another member, denies non-admin editorial uploads, creates a real forum topic through atomic Rules constraints, assigns a trusted test-only claim, publishes an article and moderates reports/listings with an audit record.

Unit tests cover bounded prefix tokens, listing/community schemas, controlled categories, private/public schema separation, safe event links/time ranges, missing configuration and emulator/development project safeguards.

## Scope and reproducibility

`test-local.bat` runs `npm run test:integration`. It launches project `demo-throttlehub-tests` with Firestore 8180, Auth 9299, Storage 9298, hub 4401 and websocket 9151. Exact test endpoints are checked before test-only cleanup. No manual fixtures or account preparation is needed. It can run alongside ordinary `demo-throttlehub` development, whose read-only counts remained zero after isolated testing.

HTTP 200: `/`, `/browse`, `/forum`, `/forum/new`, `/news`, `/stolen-bikes`, `/stolen-bikes/report`, `/events`, `/admin/community`, `/admin/editorial`, `/admin/events`, `/info/about`, `/info/help`, `/info/contact`. Access-gated routes returning 200 show their gate, not privileged data. HTTP checks do not establish successful browser form interactions.

The owned startup process was stopped after QA; subsequent requests to web and emulator hub confirmed no listeners. Tests shut their own services down. Run `start-dev.bat` again for local use. Emulator data is ephemeral across restarts.

## Remaining verification

No desktop/mobile screenshot, overflow, keyboard-navigation, client-console or browser form journey is claimed. Auth email links, image compression/reordering, cover uploads, moderator UI and authenticated evidence getBlob/CORS need browser testing. Backend tests verify Rules and SDK journeys, not every UI implementation path. Arbitrary compound-filter indexes need an authorised staging check because emulators do not enforce deployed composite indexes. See DEVELOPMENT.md for implementation limits and launch gates.

The Admin SDK emitted a local metadata-detection warning when access to the host metadata address was blocked; emulator operations still completed successfully. No production Firebase project, account, credentials or data were used. No Git operations, deployment, purchase or remote reset occurred.
