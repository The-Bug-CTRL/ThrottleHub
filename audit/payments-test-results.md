# Payment promotion verification

27 October 2026. All Firebase test records were confined to loopback `demo-throttlehub-tests`. Paystack transport was mocked or replaced with controlled providers; no external payment API success, money movement, live record or deployment is claimed.

- **226 tests passed across 41 files**, full isolated emulator/application suite, script exit 0: `.tools/payments-tests-final.log`.
- TypeScript source/tests passed using `.tools/home-layout-typecheck.json`; fresh Next.js production build passed, exit 0: `.tools/payments-build-final.log`. Isolated copy preserved the running `.next`.
- Dedicated Functions TypeScript build passed: `node payments-functions/node_modules/typescript/bin/tsc -p payments-functions/tsconfig.json`.
- ESLint: **0 errors, 19 existing warnings**, exit 0: `.tools/payments-lint-final2.log`.
- Local compiled Functions manifest confirms six v2 exports in europe-west1, with Test/Live secret bindings separated. Installed CLI selector/filter validation was inspected locally; no cloud deployment was exercised.
- Read-only cloud policy/index backup failed closed for unavailable authorized credentials: `.tools/payments-cloud-index-check.log`. No current index READY/policy/IAM claim can be made. Prepared count is **171** (155 preserved plus 16 payment additions).

The first test run failed because its fake provider reused transaction IDs across separate orders; the uniqueness guard rejected them. The fixture was corrected to issue unique IDs. Contended emulator transactions use a bounded longer test timeout. The first Next.js build required a TypeScript extension alias for shared NodeNext source; the corrected build passed. No security permissions were weakened to resolve these failures.

Coverage includes pricing/disabled products, amount units, supported official API calls, raw-body signature validation and forgery, body bounds, verified-token and caller identity, foreign and unavailable listings, suspended sellers, pending-order reuse, initialization limits, duplicate reference/transaction handling, concurrent webhook/callback fulfilment, unchanged original advert timestamps, Test/Live separation and zero Test revenue, promotion expiry, bumps versus later organic ads, page deduplication, refund/dispute replay, immediate reversal suspension during provider outage, partial refund review, recoverable delayed success, scheduler recovery and client default-deny for accounting/entitlement paths. Existing Auth/Google emulator, listings, photo/FFmpeg video, messaging, favourites, forum, historical content and source-feed tests passed.

Not performed: genuine Paystack TEST checkout/refund/dispute delivery, hosted webhook/Eventarc/Scheduler execution, live secret access/IAM, cloud index validation, interactive browser/mobile purchase flow or real-money testing. These require approved credentials/configuration/deployment and designated genuine content. Earlier browser access was denied. Automated React/API/emulator checks are not represented as live/browser acceptance.
