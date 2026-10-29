# Payment dependency security upgrade

28 October 2026. Local work only; no deployment, cloud secret/rule/configuration change, external payment or production data mutation.

## Changes

Only the payment package manifest and lockfile required implementation changes:

- `firebase-admin`: pinned from 13.10.0 to **14.5.0**.
- `firebase-functions`: pinned from resolved 6.6.0 (`^6.0.0`) to **7.4.0**, whose peer range explicitly supports Admin v14. Version 6.6.0's peer range did not.
- Removed unused `throttlehub: file:..`. No payment source imports that package. This removes the parent website dependency/link and keeps the deployment package independent.
- Regenerated a standalone npm lockfile and verified it with clean `npm ci --ignore-scripts --no-audit --no-fund`. No `audit fix --force`, `--legacy-peer-deps`, or dependency overrides were used. The root website's manifest, lockfile and existing overrides were not changed.

Resolved Google clients: **@google-cloud/firestore 9.4.0**, **@google-cloud/storage 8.4.0**. No uuid package remains in the payment lockfile; the parent-project link is absent. `npm ls` for the payment tree exits 0 with no peer/dependency errors.

## Compatibility review

Runtime remains Node **22**; verification used **22.23.4**. Admin v14 requires Node 22 or later and removes legacy namespace imports. All payment imports already use `firebase-admin/app` or `firebase-admin/firestore`, so no source migration was necessary. [Official Admin release notes](https://firebase.google.com/support/release-notes/admin/node).

Reviewed all payment catch blocks against the [Admin error handling guide](https://firebase.google.com/docs/reference/admin/error-handling). They do not rely on removed namespace error constructors, undocumented SDK message matching, legacy `errorInfo`, or SDK code values to authorize/fulfil payments. Only the application's own `PaymentError` selects expected HTTP errors. Other provider/SDK errors remain failures, with durable retry/review records; no SDK error can substitute for successful authoritative transaction verification. No error-handling source change was necessary.

Compiled entrypoint loads on Node 22. All six Functions exports remain gcfv2 in europe-west1. Manifest inspection confirms each TEST export binds only the TEST secret, and each LIVE export only the LIVE secret. This is a local manifest check, not a deployed IAM/runtime check.

## Exact verification results

- Initial production audit in this session: **9 moderate, 0 high, 0 critical** (the owner's earlier run reported 8). Final `npm audit --prefix payments-functions --omit=dev`: **0 vulnerabilities**, exit 0. No uuid advisory remains. Raw reports: `.tools/payments-audit-before.json`, `.tools/payments-audit-final.json`.
- Clean payment lockfile install: **246 packages installed**, exit 0. npm emitted transitive deprecation notices for glob/node-domexception; the final security audit reports no known vulnerabilities. Deprecation notices are distinct from audit findings.
- Payment TypeScript build: **passed**, exit 0, after clean installation.
- Application/source/test TypeScript compatibility check using `.tools/home-layout-typecheck.json`: **passed**, exit 0.
- Existing isolated emulator/application suite: **230 passed across 42 files**.
- Additional payment suite explicitly resolving Admin imports to the payment package's **14.5.0** SDK: **21 passed across 3 files**. This avoids relying solely on the unchanged website's Admin v13 SDK. Combined emulator runner exit 0. Evidence: `.tools/payments-v14-tests.log`; local rerun helper `.tools/test-payments-v14.mjs` and alias config `.tools/payments-v14.vitest.config.mts`.

The 21 are a second run of existing payment tests, not 21 new unique tests. They cover raw-body HMAC/forgery rejection, verified identity and ownership, server pricing, mismatched transactions, concurrent idempotent fulfilment, unchanged original advert dates, TEST/LIVE separation, client default-deny, limits, delayed success, refunds/disputes, partial refunds during provider outage and scheduled reconciliation. The full suite also covers the existing listing/media/Rules contracts.

## TEST deployment decision

**Dependency/build/security-regression gate: GO for the first approved TEST deployment.** Production audit is clean and payment tests pass on the actual upgraded SDK. This is not approval to deploy and not a LIVE-payment readiness declaration. Existing setup gates still apply: TEST secret/access permissions, required indexes READY, correct selective TEST deployment, dashboard TEST webhook URL, and real hosted checkout/webhook/reconciliation acceptance with designated genuine content. No real Paystack checkout or hosted Functions execution was performed here. Follow `PAYSTACK_PROMOTIONS.md`; preserve the separate LIVE approval gate.

Reproduce standard checks with Node 22 on PATH:

```powershell
npm ci --prefix payments-functions --ignore-scripts --no-audit --no-fund
npm --prefix payments-functions run build
npm audit --prefix payments-functions --omit=dev
npm ls --prefix payments-functions firebase-admin firebase-functions @google-cloud/firestore @google-cloud/storage uuid
npm run test:integration
```

The package remains self-contained. Avoid installing the parent website as a dependency when operating npm from outside the package; if local npm unexpectedly re-adds that link, run npm from `payments-functions` and review manifest/lock changes before continuing.
