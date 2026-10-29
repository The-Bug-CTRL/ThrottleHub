# Homepage index investigation — 28 October 2026

Project: `throttlehub-9d6b9`. No deployment, rule change or live document write was performed.

## Finding and permanent remedy

The original 155-index release predates promotion ranking. `getPublicListings(undefined, 18)` now performs an additional collection-scoped query:

```ts
db.collection("listingPromotionsLive")
  .orderBy("bumpedAt", "desc")
  .orderBy("listingId", "desc")
  .limit(64).get();
```

Development explicitly configured with `THROTTLEHUB_PROMOTION_PREVIEW_TEST=true` uses `listingPromotionsTest` instead (unless payment mode is live). Checkout being disabled does not disable reading existing promotions. An empty promotion collection still needs the query index. A rejection of this query rejects the entire Latest Listings operation, even when its original listings query succeeds.

Both required composites already exist in the current 171-entry local catalogue and its generator. They are part of the 16 prepared Paystack additions, absent from the original 155. **No new/duplicate index was added in this fix.** Deploying the current reviewed catalogue and waiting for READY is required if the cloud still has only the original 155. Disabling paid ranks or ignoring their database errors would hide the configuration problem and break intended placements.

Required fields for each `listingPromotionsLive` / `listingPromotionsTest` index, scope `COLLECTION`:

```json
[
  { "fieldPath": "bumpedAt", "order": "DESCENDING" },
  { "fieldPath": "listingId", "order": "DESCENDING" }
]
```

Firestore implicitly appends `__name__ DESC`. Search pagination uses `startAfter(time, listingId)` (or `startAt(time)`); the homepage has no cursor. No status filter is removed: entitlement namespace/activity, listing status/owner/ZA/ZAR and seller restriction checks remain in the trusted readers. Organic and paid ranks are merged and deduplicated; original `createdAt` is untouched.

This is the concrete catalogue/deployment mismatch identified from source and the owner's reported 155 deployed indexes. The exact observed live exception cannot be certified here: read-only backup failed for unavailable authorized Admin credentials. Another FAILED_PRECONDITION remains possible; new stage-specific logs make it distinguishable instead of assuming every code 9 means a missing index.

## Other homepage queries

| Reader | Filters and order | Local coverage |
| --- | --- | --- |
| Organic Latest | listings: status=published, country=ZA, currency=ZAR; createdAt DESC; limit 32 | Existing COLLECTION composite: status ASC, country ASC, currency ASC, createdAt DESC |
| Optional category Latest | Same plus category equality | Existing composite adds category ASC before createdAt DESC |
| Featured | listingPromotionsLive/Test: featuredActive=true, __name__ ASC; startAt/endBefore SHA-256 rotation key; up to 32 combined | Default ascending featuredActive single-field index, with implicit __name__ ASC; no local exemption disables it |
| Discussions | forumThreads: status=published; lastReplyAt DESC; limit 8 | Existing COLLECTION composite: status ASC, lastReplyAt DESC |

Featured independently checks environment, expiry, listing eligibility/ownership and restrictions. Its hydration uses direct document reads, requiring no composites. Organic promotion hydration likewise uses document reads. Cloud single-field exemptions and actual READY states still require live verification. [Firebase index ordering reference](https://firebase.google.com/docs/firestore/query-data/index-overview).

## Code changes

- `src/lib/firestore-diagnostics.ts`: log context, Firebase code, message and details, then rethrow unchanged. Index creation URLs remain available in the terminal.
- `src/lib/server.ts`: label organic Latest and promotion hydration failures.
- `src/lib/promotion-readers.ts`: label exact bump namespace/order/cursor and featured rotation query failures. Ranking and eligibility are unchanged.
- `src/app/page.tsx`: log rejected settled sections and streamed highlights; show only a generic retry message to visitors, never provider details.
- `src/lib/errors.ts`: distinguish an explicit index diagnostic from other failed preconditions; never include provider URLs in precondition UI text.
- `tests/homepage-indexes.test.ts`: verify local composites, actual bump order/cursor, featured default-index contract, and server logging/rethrow versus public precondition messages.

## Validation

- Full isolated emulator/application suite: **230 passed, 42 files**, exit 0 (`.tools/homepage-index-tests-executable.log`). The first sandboxed run passed 211 but could not spawn FFmpeg; rerunning with executable access passed all 230, without changing tests or permissions.
- TypeScript source/tests check passed with `.tools/home-layout-typecheck.json` (excludes the running dev server's generated build files).
- Isolated Next.js production build passed, exit 0 (`.tools/homepage-index-build.log`), preserving the user's development `.next`.
- Targeted ESLint check passed with no errors/warnings. Four new homepage regression tests passed; existing paid-ranking, lifecycle and media regressions passed in the full suite.
- Read-only live backup failed closed for unavailable authorized ADC (`.tools/homepage-index-cloud.log`). No live query or index readiness result is claimed. The emulator does not enforce cloud composite indexes; catalogue checks cover the exact prepared definitions instead.

## Deployment preparation only

After separately approving index deployment, run from this workspace:

```powershell
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.json --project throttlehub-9d6b9 --only firestore:indexes
```

This selects indexes only, not Rules, Storage, Functions or Hosting. Review unexpected deletion prompts; do not approve removing unmanaged cloud indexes. With no global Node, replace `node` with `.\.tools\node-v22.23.4-win-x64\node.exe`.

With authorized read credentials, verify after deployment:

```powershell
node scripts/backup-firebase-security.mjs
node scripts/check-firebase-index-readiness.mjs
```

Wait for required indexes to be READY, restart/reload `npm run dev` and inspect the terminal. Any remaining failure now identifies its section and query stage with the original diagnostic. No live fix/readiness is claimed before that check.
