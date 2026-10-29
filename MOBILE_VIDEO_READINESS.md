# Listing videos and mobile improvements

28 October 2026. Workspace `E:\ThrottleHub_codex_code`. Local implementation only: no deployment, live listing/user write, production configuration, payment backend, Rules or index changes. Prior unrelated uncommitted work was preserved.

## Video policy

`requiresRunningVideo(categoryId)` in `src/lib/taxonomy.ts` is the shared classification. It uses the canonical category's structured `itemType`, resolving retired category aliases, never display labels, title keywords, make/model or engine-fitment selections. All **19 motorcycle taxonomy nodes** require a video when publishing/relisting:

- `motorcycles` and all motocross descendants (two-stroke, four-stroke, youth).
- `motorcycles/enduro` and hard-enduro, cross-country, trail-enduro and road-legal descendants.
- `motorcycles/trials` and modern/youth descendants.
- `motorcycles/trail` and trail, recreational and youth/mini descendants.
- `motorcycles/pit-bikes`.
- `motorcycles/kids-bikes` (including small 50/65/85cc bikes; displacement does not exempt a bike).

Every non-motorcycle node is exempt from mandatory footage: complete engines, cylinder heads, pistons, exhausts, wheels/tyres and other parts; gear, electronics/GPS, equipment/accessories and tools. Valid photos and listing information remain required. Fitment/make/year on a part do not make it a motorcycle.

The UI already partly distinguished these categories, as did the trusted server. This work consolidates that decision and fixes a real persistence inconsistency: saving a motorcycle as a part previously cleared its ready video reference. Valid owned footage is now retained as optional media and displayed as a seller video. A user can explicitly remove it from the form; an ordinary category change does not delete the file. Publication of an attached ready video still checks its actual Storage object. Ordinary form category switching also remembers category-specific detail fields within that form session, restoring them when switching back; this is not new cross-reload draft persistence.

The create/edit upload section changes its required/optional wording immediately. The same helper covers trusted save, publish, status/relist and legacy video inventory. Incomplete motorcycle drafts remain allowed; publishing or republishing requires a same-owner/same-listing trusted ready record and generation/size/MIME/existence checks. Petrol motorcycles retain required audio checks and existing full decode/remux validation. A request's fake video flags cannot supply a ready record. Current category/label validation and default-deny client publication/ready-record rules remain intact. Storage slots, limits, ownership and historical retention checks were not weakened and needed no rule changes.

Classification cannot prove that a seller's description/category or depicted motorcycle is truthful. Existing reporting/moderation remains necessary; this change does not claim automatic semantic recognition of bike footage or completed mechanical inspection. No existing public advert was reclassified, hidden, migrated or rewritten. Historical URLs and original dates remain unchanged.

## Mobile changes and review scope

Shared refinements live in `src/app/mobile.css`, imported after the established stylesheet. Brand tokens/typography remain unchanged. No new frontend dependencies, image proxy, video transcoder or payment transport were introduced. The responsive work is implemented, but **is not browser/device certification or a public-launch security clearance**.

| Area | Implemented/reviewed behavior |
| --- | --- |
| Shared header/navigation | Small-screen Search, Sell, Messages and Account shortcuts; safe-area spacing; touch-sized header controls; native navigation dialog locks background scrolling. Desktop navigation retained. |
| Homepage | Existing bounded listing/news/highlight/calendar rails preserved. Shared heading/grid wrapping and readable small-screen listing text. Intentional carousel scrolling remains; no blanket body overflow-hiding is used to disguise layout defects. |
| Browse/search | Narrow inputs/selects, larger touch targets, wrapping sort/filter rows, bounded dropdowns, safe-area dialog actions; single-column cards at 320/360, two columns on larger phones. Existing left filters and shared popup state retained. |
| Listing details/gallery | Contained video, larger gallery actions, dominant-horizontal swipe detection so vertical scrolling does not accidentally change photos; zoom scroll lock/focus restoration. Optional retained video has an honest seller-video heading. |
| Create/edit | One-column phone form rows, numeric/decimal keyboards, sticky draft/back/continue/publish actions; readable labels and upload previews. Photo filenames/completion progress and selected video filename are visible. Browser image-decode fallback when createImageBitmap fails. Existing server photo/video validation retained. |
| Auth | Shared 16px input sizing to avoid common iOS focus zoom, touch targets and narrow panel sizing. Existing email/password, Google/account-type and persistence logic untouched. |
| Account/business/profile | Shared narrow rows, wrapping account navigation/actions, responsive listing grid, long-text handling. Existing private/public field boundaries untouched. |
| Messaging | Selected phone chat uses visualViewport height/offset, a flexing scrollable message list and nonshrinking composer, with an accessible back-to-conversations action. Bottom shortcuts hide while chatting/typing. Listeners are removed on unmount. |
| Forum | Shared wrapping community layouts, controls and embedded-media behavior; existing video embeds remain click-to-load. Posting/media authorization unchanged. |
| Stolen bikes | Shared forms, controls, narrow grids and long-text handling. Evidence/media security unchanged. |
| Events/news/highlights | Wrapping filter controls and cards; existing bounded feeds, reserved image proportions and click-to-load videos retained. Lazy images decode asynchronously. |
| Promotions/returns/history | Narrow single-column product cards/dialog, wrapping references and actions. Same hosted Paystack redirect, server prices, verification, HMAC/idempotency/refund/reconciliation and TEST/LIVE boundaries. No external checkout was opened. |
| Administration | Wrapping staff navigation/forms; payment review UI now checks existing admin claim hook before rendering tools. Server authorization remains authoritative and unchanged. |
| Footer/modals/accessibility | Existing footer structure retained; shared focus indicators, touch targets, bounded dialogs, safe areas and reduced-motion behavior. No hover-only critical action added. |

## Browser and screen-size coverage

Browser inventory returned no browser automation host. Native Opera inspection was attempted, but Computer Use stopped because it could not reliably identify the current Windows browser URL. No browser/page interaction continued after that block. **No responsive screenshots or real-browser/device layout measurements were obtained.** Automated markup/CSS/source inspection is not substituted for them.

| Width | Code coverage/review | Real-browser result |
| --- | --- | --- |
| 320px | Narrow header, one-column cards/forms, bounded dialogs and touch targets | Not tested |
| 360px | Same narrow breakpoint | Not tested |
| 390px | Phone grid/forms, fixed shortcuts and safe areas | Not tested |
| 430px | Phone grid/forms, fixed shortcuts and safe areas | Not tested |
| 768px | Tablet dialog/product/nav wrapping; existing tablet grid rules retained | Not tested |
| 1024px | Staff navigation/dialog constraints; existing desktop/tablet layout retained | Not tested |
| 1440px | Desktop layout retained, shared min-width/wrapping/accessibility refinements only | Not tested |

Neither iPhone Safari nor Android Chrome was run. Manual acceptance must check each width for unexpected root scrolling, text clipping and focus order, then real devices for keyboard/composer movement, rotation, safe areas, native select/dropdown stacking, gallery swipe/zoom, file picking/cancel/retry, Google popup/redirect persistence and Paystack TEST return behavior. Long references, listing titles and province/town names should be included. Do not enter live payment credentials or publish invented cloud inventory for QA.

Remaining practical limitations: iPhone MOV/HEVC and unsupported photo formats may need export as H.264/AAC MP4 or JPEG/PNG; the existing trusted video pipeline intentionally remains strict. Camera upload acceptance and audio must be tested on actual phones. Browser image fallback is implemented but not device-verified. Listing cards still use the validated source image rather than a separate thumbnail pipeline; imported publishers control their image sizes. Existing homepage promotion hydration is bounded but potentially read-heavy; no query security/ranking or stale-result cache was changed to reduce costs. Existing public-launch security/operations blockers from earlier audits remain applicable.

## Automated results

- Full isolated emulator/application run: **251 passed across 45 files**, exit 0 (`.tools/mobile-video-tests-final.log`). It includes actual FFmpeg validation, media ownership/history, new six motorcycle-branch denials, nine non-motorcycle publication cases, category switching/optional media retention and original dates, plus existing payment/Auth/profile/community/Rules regressions.
- New pure taxonomy and upload-copy tests verify all taxonomy classifications, legacy aliases and required versus optional wording.
- Initial full run had 248 passing and two failures: concurrent emulator transaction invalid/closed and the CLI region test's five-second module-load timeout while the build competed for resources. No payment code/security assertion was changed. The module-load test now has a bounded 15-second allowance; the complete rerun passed.
- TypeScript source/tests check passed with `.tools/home-layout-typecheck.json`.
- Full ESLint: **0 errors, 19 warnings** (existing image/hook advisories), `.tools/mobile-video-lint-all.log`.
- Final isolated Next.js production build passed, exit 0 (`.tools/mobile-video-build-final.log`), preserving the running development `.next`.

## Changed files and release

- `src/lib/taxonomy.ts`, `src/lib/listing-lifecycle.ts`, `src/lib/video-maintenance.ts`: shared classification and safe optional-media retention.
- `src/components/listing-form.tsx`, `listing-details-fields.tsx`, `running-video-upload.tsx`, `running-video-player.tsx`, `detail.tsx`: category/media behavior, copy, upload feedback, form controls and sticky publication action.
- `src/app/mobile.css`, `src/app/layout.tsx`, `src/components/shell.tsx`, `gallery.tsx`, `marketplace-filter-fields.tsx`, `card.tsx`, `imported-feed.tsx`: shared responsive/accessibility/media refinements.
- `src/app/messages/page.tsx`, `src/app/admin/payments/page.tsx`: keyboard-aware phone chat and staff-only payment review presentation.
- `tests/seller-video.test.ts`, `tests/video-category-policy.test.ts`, `tests/video-upload-copy.test.tsx`, `tests/payment-regions.test.ts`: regressions and bounded CLI module-load timeout.
- This report. No payment Functions implementation/configuration, Rules, indexes, secrets, environment or production documents were changed.

Restart the local app to review. For a hosted release, ship the compatible Next.js frontend and trusted Next.js listing API together after approval and manual acceptance. This change needs **no new Firestore/Storage Rules, index or Paystack Functions deployment**. Existing prepared releases and operational prerequisites remain separate. Nothing was deployed by this task.
