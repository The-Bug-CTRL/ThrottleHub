# Current Firebase integration test results

23 October 2026. **157 passed, 0 failed, 25 files.** This supersedes the earlier 154-test feature run and 128-test original audit.

See [final deployment decision](../FIREBASE_DEPLOYMENT_GO_NO_GO.md) for scope, cloud verification, limits, commands and remaining blockers. Full isolated demo-emulator run: `.tools/final-integration-tests.log`, exit0. Actual FFmpeg/ffprobe decoding/remux is included. TypeScript passed; ESLint has 0 errors and 18 existing warnings; isolated production build passed, exit0. Cloud backup completed; provider verification returned HTTP403; no deployment performed.

| Test file | Passing cases |
| --- | --- |
| tests/seller-video.test.ts | 19 |
| tests/listing-history-integration.test.ts | 4 |
| tests/rules.test.ts | 35 |
| tests/security-audit.test.ts | 22 |
| tests/workflows.test.ts | 1 |
| tests/marketplace-query.test.ts | 1 |
| tests/notifications-integration.test.ts | 1 |
| tests/category-artwork.test.ts | 3 |
| tests/admin-config.test.ts | 4 |
| tests/listing-detail.test.tsx | 2 |
| tests/search-controls.test.tsx | 4 |
| tests/marketplace.test.ts | 10 |
| tests/marketplace-api.test.ts | 7 |
| tests/listing-history.test.ts | 5 |
| tests/models.test.ts | 6 |
| tests/video-api.test.ts | 6 |
| tests/listing-api.test.ts | 3 |
| tests/request-body.test.ts | 3 |
| tests/seller-components.test.tsx | 4 |
| tests/configuration.test.ts | 4 |
| tests/community-extras.test.ts | 3 |
| tests/reviews.test.ts | 2 |
| tests/public-listing.test.ts | 1 |
| tests/index-catalogue.test.ts | 1 |
| tests/design.test.ts | 6 |

New regressions deny stale or missing accepted files at publication/relisting, absent Storage configuration, daily arbitrary-listing-ID quota overflow, and staging after parent restriction. Expired video access and historical sold photo/video retention are tested. Positive and negative assertions share test cases; this count is not a count of individual permission operations. Browser/device/OAuth/cloud indexes remain outside emulator proof.
