> Initial audit snapshot. Current seller/video tests are recorded in [seller-video-test-results.md](seller-video-test-results.md).

# Firebase audit test results

23 October 2026. Test project: demo-throttlehub-tests only.

- Full suite through Firebase Emulator Suite: **128 passed, 0 failed, 22 files**.
- Firestore/Storage permission and audit regression files: **57 passed, 0 failed** (35 existing Rules cases + 22 audit cases). Tests often include several allow and deny assertions.
- New audit file classification: 6 allow-focused cases, 10 deny-focused cases, 6 mixed allow/deny cases, all passing. These are test-case counts, not a fabricated count of every rule branch.
- Additional real-emulator files: history lifecycle4, Auth/multi-identity workflows1, notifications/Google identity1, actual marketplace queries1. Total **64 emulator-backed cases**, including the 57 above.
- Token/API and configuration unit tests also passed; HTTP listing/search boundary tests use mocks as documented in the main report.
- TypeScript: passed, no errors. ESLint: passed, 0 errors, 18 existing warnings (image optimization/hook dependency warnings).
- Isolated production build: passed, exit0; no user development .next directory modified. Workspace-root/plugin notices remain.
- Local Firebase configuration: passed; exact cloud target throttlehub-9d6b9, expected bucket, complete Web values.
- Live cloud verification: **not verified**, authorized ADC unavailable. Read-only cloud backup: failure path exercised, no complete cloud backup generated.
- Git diff whitespace check: passed. Secrets/profile files remain ignored and untracked.

| Test file | Passing cases |
| --- | --- |
| tests/listing-history-integration.test.ts | 4 |
| tests/rules.test.ts | 35 |
| tests/security-audit.test.ts | 22 |
| tests/workflows.test.ts | 1 |
| tests/marketplace-query.test.ts | 1 |
| tests/notifications-integration.test.ts | 1 |
| tests/admin-config.test.ts | 4 |
| tests/listing-detail.test.tsx | 2 |
| tests/marketplace.test.ts | 10 |
| tests/category-artwork.test.ts | 3 |
| tests/search-controls.test.tsx | 4 |
| tests/listing-history.test.ts | 5 |
| tests/listing-api.test.ts | 3 |
| tests/marketplace-api.test.ts | 7 |
| tests/models.test.ts | 6 |
| tests/request-body.test.ts | 3 |
| tests/configuration.test.ts | 4 |
| tests/community-extras.test.ts | 3 |
| tests/public-listing.test.ts | 1 |
| tests/reviews.test.ts | 2 |
| tests/index-catalogue.test.ts | 1 |
| tests/design.test.ts | 6 |

Logs are retained locally under ignored .tools/security-audit-final.log, .tools/security-audit-final-build.log and .tools/security-audit-lint-release.log. Expected permission denials appear in negative tests and are not test failures. An earlier run caught an outdated conversation title fixture; a subsequent run caught search-token removal before server refinement. Both were corrected and the final full suite passed.

Limitations: emulator tests do not validate real OAuth consent, email delivery, index creation, cloud IAM/CORS/App Check or visual/browser races. Refer to FIREBASE_SECURITY_AUDIT.md for the outstanding launch blockers.
