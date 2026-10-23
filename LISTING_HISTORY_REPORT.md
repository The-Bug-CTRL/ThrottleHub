# ThrottleHub listing history

Implemented locally in the existing Next.js/Firebase application. No deployment, Firebase project configuration change, production migration, production seed data, or production listing deletion was performed.

## Behaviour

| Status | Active browsing/search | Original link | New enquiries | Seller changes |
| --- | --- | --- | --- | --- |
| Active (`published`) | Yes | Public | Enabled | Edit, mark sold, expire, hold, remove |
| Sold | No | Public history | Disabled | Remove; no retroactive editing or relisting |
| Expired | No | Public history | Disabled | Reactivate the same item or remove |
| On hold | No | Public history | Disabled | Reactivate, mark sold, expire or remove |
| Draft | No | Private; public URL is 404 | Disabled | Edit, publish or remove |
| Rejected / restricted (`hidden`) | No | Public URL is 404 | Disabled | Removal; staff review |
| Removed | No | Public URL is 404 | Disabled | Cannot be restored or reused |

The existing `/listing/{id}/{slug}` format is preserved. IDs do not change. A changed title updates the slug; old title URLs redirect to the current canonical URL with HTTP 308. Availability is checked in middleware before the root loading boundary streams, so an unavailable advert produces an actual 404 rather than a streamed 200. A database outage produces 503 instead of falsely declaring the advert gone.

## Historical pages and discovery

- Sold, expired and on-hold pages are rendered on the server with the normal gallery, description, specifications, general location and advertised asking price.
- Historical status is prominent. The price is labelled as an asking price, not a verified transaction price. No buyer identity or completed sale price is invented.
- Newly published adverts capture their first asking price and publication time. The current/last asking price remains separate. Pre-existing adverts are not backfilled with invented original prices or publication dates; their existing creation date remains the fallback display date.
- Sold/expired timestamps are recorded when the status changes. The existing `createdAt` date is preserved during edits and reactivation.
- New enquiry controls are disabled in historical pages, and Firestore rules reject new conversations for unavailable adverts. Existing participant conversations remain independent of listing status.
- Canonical metadata, historical page titles, Open Graph photos and Product/Offer structured data are provided. Sold adverts use `SoldOut`; expired/on-hold adverts use `OutOfStock`. Development's existing site-wide noindex remains unchanged; historical status does not add noindex in production.
- Public pages use an explicit field projection rather than spreading arbitrary Admin SDK document fields into browser props. Private account email, messaging data and moderation records are not included.
- Historical image URLs remain unchanged while an advert is sold, expired or on hold. A removal/privacy restriction is an intentional exception.
- No new archive search or PWA was introduced. The existing sitemap remains unchanged. Search engines can discover linked public historical pages, but indexing or perpetual Google Images retention is not guaranteed.

## Trusted lifecycle and permissions

All website listing saves and status changes now use `POST /api/listings/{id}` with a Firebase ID token. The server verifies the token, including revocation, and derives identity and staff claims only from that token. Client-supplied actor/admin values are ignored. The existing Admin project/configuration guards still apply.

Transactions enforce ownership and allowed transitions, preserve IDs, freeze completed adverts, record server-generated millisecond timestamps and store protected price/status events under `listings/{id}/history/{event}`. Events contain status, advertised prices and timestamps, without conversation contents, buyer identity or free-text copies. Owners and administrators can read these events; ordinary clients cannot write them.

Direct Firestore publication and direct edits to published/history adverts are denied. Legacy draft staging remains possible under validated rules, but publication must use the trusted API. Drafts, rejected/hidden records and removed records do not become public through the historical read allowance. Existing administrative hide permissions are retained for compatibility; the updated moderation interface uses the server workflow so photo restriction runs too.

Image references supplied to the save API must point into the configured bucket and authenticated seller's listing path. Storage rules prevent another owner uploading into an existing advert, prevent overwriting a published photo, and prevent the seller deleting/overwriting historical photos. No additional composite indexes are required by the new ID lookups, transactions or owner pagination. `firestore.indexes.json` is unchanged.

## Dashboard and removal

Your garage now has status filters, historical-view links, explicit sold/expired/on-hold controls, same-item reactivation, and a separate removal action. Published adverts cannot be put back into draft to erase their public history. The old 40-advert hard limit has been replaced with cursor-based Load more; filters apply to loaded records, as labelled in the dashboard.

Removal immediately replaces the public advert with a minimal inaccessible tombstone, discarding its title, description, price, photo references and specifications. Cleanup deletes the complete listing-photo prefix (including unused originals/thumbnails), private moderation copies and price/status event records. After cleanup it clears the seller identifier from the tombstone. The tombstone reserves the ID; it is not a publicly visible deleted advert.

Restriction moves photo bytes to a private `listing-restricted/{ownerId}/{listingId}/` prefix without copying download tokens, then deletes the old public objects. Client Storage access to this private prefix is denied by the existing catch-all rule. These copies are for administrator review, not historical public galleries.

Cleanup failures return HTTP 202 with an explicit warning and retain a private `listings/{id}/mediaCleanup/pending` job. An owner can retry a pending removal; administrators can use the Listing ID and **Retry media cleanup** control under Moderation. The job/account identifier is erased after successful cleanup. Concurrent newer cleanup requests are not discarded by an older completion.

Administrators can also **De-identify historical advert**: this clears the seller link, replaces free text/title/slug with neutral item information, clears general city, removes photo references and technical free-text fields, and deletes associated photos. Basic make/model/year/category and asking-price history may remain. The old ID still resolves through canonical redirection. Review and de-identify/remove all relevant adverts before deleting a seller's account. This does not implement automatic account deletion or change private conversation retention.

## Verification

Run from the project directory:

```powershell
npm run test:rules
npm run typecheck
npm run lint
npm run build
```

The emulator runner explicitly uses the isolated `demo-throttlehub-tests` project on loopback ports 8180/9299/9298, removes cloud credentials from its environment and cleans up its temporary records. Test data is not written to the real Firebase project.

The lifecycle emulator scenarios cover publication, sold/expired/hold visibility, exclusion from active queries, preservation of IDs/prices/photos, immutable history, reactivation, private drafts/rejections, ownership checks, new-conversation rejection and existing conversation access, de-identification, media restriction and removal. Additional tests cover server-rendered historical content, disabled controls, canonical redirects, real middleware 404/308 behaviour, structured availability, verified-token boundaries and cleanup failure reporting.

Local verification logs are in `.tools/listing-history-tests.log`, `.tools/listing-history-lint.log` and `.tools/listing-history-build.log`. The production build was run in an isolated copy under `.tools` to avoid replacing a running development server's `.next` directory. ESLint retains 18 existing warnings; there are no lint errors. Browser UI automation is unavailable in this session, so browser interaction and live-cloud behaviour still need acceptance testing.

Final automated results: **86 tests passed across 16 test files**, including the isolated Auth, Firestore and Storage emulators. **TypeScript passed. Production build passed. ESLint: 0 errors, 18 existing warnings.**

## Before production

1. Supply working server Application Default Credentials / managed runtime identity for the existing Firebase project. It needs the existing Firestore/Auth verification access plus the Storage permissions for metadata reads, downloads, private writes and deletion. No service-account secrets are embedded in browser code.
2. Review and approve the development policy at `/policies/history` alongside the existing privacy/terms drafts. The operator must determine the lawful retention basis, review schedule, moderation-copy retention periods, messaging/account retention, support contact and privacy-request process. This implementation does not purport to supply legal approval for indefinite personal-data retention.
3. Assign responsibility for monitoring/retrying private cleanup jobs and resolving moderation copies. There is no new background worker, expiry scheduler, Cloud Function or bucket lifecycle configuration. Expiration is currently an explicit seller/staff status change; it never automatically deletes an advert.
4. Coordinate release of the updated application with its rules: older clients that directly publish/update adverts will be denied by the new rules. Genuine live creation/editing depends on the authenticated server API being deployed and credentialled.
5. Test live using your own clearly labelled test advert and controlled accounts: publish, copy the URL, hold, reactivate, edit the title/price, expire, reactivate and mark sold. Confirm old title links redirect, the advert disappears from active searches, asking-price labels are correct, photos remain, and new conversations are rejected. Finally use Remove on that test advert and verify its page/photo links are unavailable. Use a separate test advert for de-identification. Do not use a customer's advert for this acceptance test.
6. Browser/CDN/search-engine copies already downloaded cannot be recalled by deleting the origin. New listing uploads use a short five-minute public cache lifetime; private copies use no-store. Handle valid external cache/search removal requests operationally.

No existing listing migration is required. Historical fields are optional for legacy records and captured prospectively. No production content was modified to fabricate history.

## Deployment commands — approval still required

These are prepared commands only; none were executed:

```powershell
Set-Location E:\ThrottleHub_codex_code
.\node_modules\.bin\firebase.cmd projects:list
# Verify the exact target is throttlehub-9d6b9 before continuing.
.\node_modules\.bin\firebase.cmd deploy --only "firestore:rules,storage" --project throttlehub-9d6b9
```

The explicit `--project throttlehub-9d6b9` prevents accidentally deploying to the default emulator alias. No new indexes or Firebase project settings need deployment for this change. The application also needs a separately approved release using the established hosting process; this report does not deploy the website or Cloud Functions.
