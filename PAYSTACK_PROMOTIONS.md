# Paystack listing promotions

27 October 2026. Project **throttlehub-9d6b9**. Implementation is complete locally and defaults to disabled TEST checkout. **No deployment, secret creation, external Paystack transaction, live charge, cloud data write, website release or AWS configuration was performed.** External acceptance is still required before describing the system as live/revenue-ready.

## Delivered behavior

- Server catalogue: **Bump R19 (1900 ZAR cents)**, **Featured 7 days R49 (4900 cents)** and **Featured 30 days R129 (12900 cents)**. Edit prices/`enabled` in `payments-functions/src/core/catalogue.ts`, then release the compatible application/Functions. Existing orders retain their original quote/duration. These are one-time products, not subscriptions.
- An authenticated seller can open **Promote Listing** on an eligible advert or in Account. Products show price, benefits and duration/cooldown, with an explicit no-guaranteed-views/enquiries/sale notice. Selling/holding/removing stops placement; time does not pause. Account shows active placement/expiry, prior purchases and payment rechecks; `/account/promotions` retains purchase history even if an advert disappears. `/admin/payments` is a server-authorized administrator-only review queue with immutable review notes and refund-required flags. Moderators alone cannot access finance review.
- Hosted Paystack checkout is initialized from the verified UID and Firebase Auth account email, with server-selected amount/currency/reference/callback. No browser amount, UID, duration, environment or promotion flag is accepted. Checkout URLs are restricted to HTTPS `checkout.paystack.com`.
- Callback and signed webhook workers share the same Verify-then-transaction service. It checks reference, exact integer amount, ZAR, Paystack `domain`, original payer association and order ownership. A Paystack transaction ID cannot fulfil another order. Fulfilment/purchase/entitlement writes commit atomically and repeated callbacks/webhooks never extend the same purchase twice.
- Only published ZA/ZAR owned adverts and unrestricted sellers can buy/receive placement. Changed ownership, sold/expired/removed/hidden/rejected adverts or an overlapping paid benefit produce a **paid-needs-review** order, not a fictional success or discarded payment. Appropriate seller status/refund-review messages remain visible.
- Checkout locks allow one pending order per listing for 20 minutes; compatible retries resume the same checkout. Six initialization starts per seller/hour and 30 authenticated verification requests per seller/15 minutes are transactionally enforced across server instances. The bump cooldown defaults to 48 hours and is configurable via `THROTTLEHUB_BUMP_COOLDOWN_HOURS` (1–720). Orders snapshot this setting; the granted cooldown endpoint is stored with the bump so independently deployed workers cannot apply a different interval.
- Signed webhooks validate the **original raw bytes** with HMAC SHA-512 and constant-time comparison, reject invalid/oversized bodies and persist a minimal receipt before returning 200. A v2 Firestore worker and 15-minute scheduled reconciliation process receipts and due orders. Failed initialization is explicitly uncertain, not silently retried with duplicate payment references. Failed, abandoned/cancelled and delayed-success payments are retained and can be rechecked. Unknown payments over seven days and repeatedly failing receipts enter review rather than retrying forever.
- Refund pending/processing/processed/failed and dispute create/remind/resolve are supported. A valid signed reversal notice immediately suspends its associated benefits, including during provider outages. The worker verifies the original transaction association before financial confirmation. Full known-amount refunds are recorded; partial/unknown-amount refunds and resolved disputes remain in review. Replayed success cannot restore reversed benefits. There is **no automatic movement of refund money**: authorized staff initiate/resolve refunds/disputes through Paystack and the signed events update the application. Admin notes cannot invent a provider refund or silently grant a paid entitlement.

## Environment separation and public ranking

Every payment collection has separate **Test** and **Live** namespaces. Test orders always recognize zero live revenue. Live API use additionally requires the explicit server `THROTTLEHUB_ENABLE_LIVE_PAYMENTS=approved` gate; the shipped default is disabled. A browser cannot choose the environment.

Public placement readers use Live entitlements by default, even while checkout is in test mode. To inspect test placement locally, explicitly set `THROTTLEHUB_PROMOTION_PREVIEW_TEST=true` with test mode. This works only outside `NODE_ENV=production`, uses the separate Test entitlements and visibly labels placements **TEST**. Production ignores that preview flag. Test transactions never write Live entitlements or listing paid flags.

Original `createdAt`/`publishedAt` dates and historical URLs remain untouched. Newest sorting merges organic creation times with trusted bump times; a newer organic listing or later valid bump can outrank an earlier paid bump. Stable timestamp/listing-ID cursors avoid duplicates across pages. Oldest/price sorts remain organic. The newest reader examines bounded organic/bump windows and hydrates relevant private entitlements; this costs more Firestore reads than the old organic-only query and selective filters can require further pages.

Featured cards come only from active, eligible, unexpired entitlements. The homepage no longer labels ordinary recent adverts as paid featured placements. It has an honest empty state, paid badges and excludes the displayed featured IDs from Latest. A deterministic five-minute circular sample across hashed listing IDs rotates eligible sellers with bounded reads; it is not a promise of equal impressions or every paid advert on every request. Server time/status checks remove expired/unavailable placement on reads without waiting for cleanup. The trusted listing lifecycle also atomically suspends both Test/Live entitlements when an advert becomes unavailable, without deleting orders/purchases/audit history.

## Firestore schema and security

The following names are suffixed **Test** or **Live**:

| Collection | Key / principal fields |
| --- | --- |
| `paymentOrders` | Unpredictable `th-test-{48 hex}` / `th-live-{48 hex}` reference; UID, listing ID, SKU/name, expected integer amount, currency, environment, payer email hash, product duration/cooldown snapshot, status/fulfilment status, created/updated/checkout/verification/fulfilment dates, transaction ID, review/reconciliation fields, recognized revenue cents. |
| `paymentOrders/{ref}/events` | Immutable reversal/admin-review events, timestamps, amount when provided, verified staff actor/note. No card data. |
| `promotionPurchases` | Reference-keyed immutable fulfilment receipt: purchaser/listing/product/price/environment, fulfilment time, feature expiry or bump time. |
| `listingPromotions` | SHA-256(listing ID) key; listing ID, UID, environment, current featured reference/active/until and bump reference/active/at/cooldown-until. |
| `paymentLocks` | Listing hash; pending reference/UID/expiry. |
| `paymentLimits`, `paymentVerificationLimits` | UID-keyed initialization/verification windows and counts. |
| `paystackTransactions` | Provider transaction ID → original reference/UID/listing, enforcing one transaction per order. |
| `paymentWebhookEvents` | Raw-payload SHA-256 key; only event kind, reference/transaction ID, optional amount, environment, processing status/attempts/times. Raw payloads, authorization/card details and secrets are not stored. |

All writes and timestamps come from trusted server services. No payment/card/checkout metadata is copied into public listing documents. Public responses only add a small trusted placement badge/expiry; raw payment documents and visitor/provider details stay private. Seller history APIs return an allowlist only to the original purchaser. Admin finance uses verified custom claims, not editable profiles or self-declared Business type.

**Rules:** `firestore.rules` retains its default-deny implementation for every new payment path, including nested audits; this update adds explanatory comments only, no client grants. `storage.rules` is unchanged. Accepted listing media protections and ordinary account registration remain intact. No private-tester gate was reintroduced. If the reviewed normal policies are already deployed, payments need no new client Rules permission. Current live policy compatibility must still be confirmed; no Rules deployment is bundled into payment deployment.

## Functions and selective deployment

`firebase.payments.json` contains **Functions only**, source `payments-functions`, codebase **throttlehub-payments**, runtime **Node 22**. All exports are v2. HTTP webhooks and scheduled reconciliation stay in **europe-west1**. Firestore workers run in **africa-south1**, explicitly targeting database **(default)**; Firebase CLI derives their Eventarc trigger location from that database, which must also be **africa-south1**.

| Test exports | Separate Live exports |
| --- | --- |
| `paystackTestWebhook` | `paystackLiveWebhook` |
| `processPaystackTestEvent` | `processPaystackLiveEvent` |
| `reconcilePaystackTestPayments` | `reconcilePaystackLivePayments` |

Region check (28 October 2026): the SDK has no separate `triggerRegion` option for `onDocumentCreated`; no unsupported property or manual manifest mutation is used. The installed CLI's Firestore preparation reads database metadata, assigns Eventarc's region to the database location and rejects a mismatch. The original Europe function region did not itself prove Eventarc was incorrectly located. Workers are now explicitly co-located to remove that ambiguity. [Eventarc location requirements](https://docs.cloud.google.com/eventarc/docs/locations).

Local region regression verification: payment Functions TypeScript build and targeted lint passed; **24 payment/API/region/integration tests across 4 files passed** using the payment package's Admin v14 SDK and isolated emulators (`.tools/payment-region-tests.log`). Region tests inspect all six actual endpoint manifests and exercise the installed CLI's database-to-Eventarc region derivation with a mocked database metadata lookup. No deployed trigger or live metadata was inspected, and nothing was deployed.

The local endpoint manifest confirms that Test exports bind only `THROTTLEHUB_PAYSTACK_TEST_SECRET_KEY`. Live exports bind only `THROTTLEHUB_PAYSTACK_LIVE_SECRET_KEY` and fail closed without the live gate. The installed CLI's codebase/function selector and filtered-secret validation were inspected. Initial selective Test deployment does not need a Live key. Real deployment/permissions are not verified by this local inspection.

**Commands below are prepared only. Secret setup, index deployment and Functions deployment are cloud changes requiring approval. None were executed.** Use existing authorized operator credentials and preserve an actual current cloud policy/index snapshot first; the read-only backup attempt here failed for missing credentials.

```powershell
Set-Location E:\ThrottleHub_codex_code
# Local installation/build only
npm ci --prefix payments-functions
npm --prefix payments-functions run build

# After approval: set only the TEST secret; enter its real value at the prompt.
node node_modules/firebase-tools/lib/bin/firebase.js functions:secrets:set THROTTLEHUB_PAYSTACK_TEST_SECRET_KEY --config firebase.payments.json --project throttlehub-9d6b9

# Approved index creation only; no Rules are deployed by this command.
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.json --project throttlehub-9d6b9 --only firestore:indexes
# Wait READY and verify exact definitions from a fresh completed read-only snapshot.
node scripts/backup-firebase-security.mjs
node scripts/check-firebase-index-readiness.mjs

# Approved exact TEST exports only; no Rules/Storage/Hosting/content Functions.
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.payments.json --project throttlehub-9d6b9 --only "functions:throttlehub-payments:paystackTestWebhook,functions:throttlehub-payments:processPaystackTestEvent,functions:throttlehub-payments:reconcilePaystackTestPayments"
```

Do not replace the selective list with an unrestricted project-wide Functions deployment, accept unexpected deletion prompts, or initialize/deploy over the separate importer project. The config does not include Firestore/Storage Rules. An authorized operator must review runtime IAM, Secret Accessor scope, Eventarc/Firestore trigger location/permissions and Scheduler service identity. Existing content imports were not accessed or redeployed.

## Required indexes and current cloud status

**155 original + 16 payment indexes = 171 prepared composites**, with no original definitions removed. `firestore.indexes.json` and its generator/catalogue are updated. For each of Test/Live, the eight additions are:

- `listingPromotions`: `bumpedAt DESC, listingId DESC` (stable paid ranking).
- `paymentOrders`: `uid ASC, createdAt DESC` (global own history).
- `paymentOrders`: `uid ASC, listingId ASC, createdAt DESC` (per-ad own history).
- `paymentOrders`: `reviewRequired ASC, updatedAt ASC` (admin queue).
- `paymentOrders`: `reconcile ASC, nextCheckAt ASC` (recovery).
- `paymentWebhookEvents`: `status ASC, nextCheckAt ASC` (receipt recovery).
- `listingPromotions`: `featuredActive ASC, featuredUntil ASC` (expiry cleanup).
- `listingPromotions`: `featuredActive ASC, updatedAt ASC` (bounded eligibility maintenance).

The existing favourites field override and normal single-field indexes remain necessary. Featured circular sampling uses `featuredActive` and document ID; no extra speculative category/search index family was added. See `audit/firebase-index-catalogue.md` for all 171 exact definitions.

**Cloud deployed/READY state is unverified.** The read-only security/index backup utility failed closed because authorized ADC/read permissions were unavailable (`.tools/payments-cloud-index-check.log`). No stale index inventory is presented as current evidence. Emulators do not enforce compound index presence. Missing cloud indexes must be built, not hidden behind fabricated data or fallback financial state.

## Configure and test a real TEST purchase locally

1. Obtain approval for the Test secret, required indexes and the three exact Test Functions above. Do not create a Live key/deploy Live exports for this stage. Keep the website local; no AWS hosting is needed.
2. In Paystack Dashboard **TEST** settings, copy the exact deployed HTTPS URL for **`paystackTestWebhook`** into the Test webhook URL. Use the URL printed by Firebase deployment; no URL was verified here. A cloud webhook works even if localhost is offline. Keep Live webhook/settings untouched. This is operator configuration, not performed by this task.
3. Configure the local Next.js server's authorized Firebase Admin ADC and access to the **Test** Secret Manager secret only. `src/lib/payments.ts` reads the secret with server credentials; an optional server-only local `THROTTLEHUB_PAYSTACK_TEST_SECRET_KEY` can override it in ignored `.env.local`. Never use `NEXT_PUBLIC_*`, source/Git or chat. Local function dotenv/secret files and build artifacts are ignored and excluded from deployment packaging. No credentials were supplied/created here.
4. In ignored `.env.local`, retain the existing real Firebase project safeguards and add:

```dotenv
THROTTLEHUB_PAYMENTS_ENABLED=true
THROTTLEHUB_PAYSTACK_MODE=test
THROTTLEHUB_APP_URL=http://localhost:3000
THROTTLEHUB_BUMP_COOLDOWN_HOURS=48
THROTTLEHUB_PROMOTION_PREVIEW_TEST=true
THROTTLEHUB_ENABLE_LIVE_PAYMENTS=disabled
```

5. Restart `npm run dev`. Sign in normally with a real designated seller account, without membership approval. Use an existing genuine published owned advert. Open Promote Listing, inspect the TEST label and exact price, and complete Paystack hosted checkout using its official test-payment details. See [Paystack's test-payment guide](https://paystack.com/docs/payments/test-payments/). **No external test purchase was performed in this task.**
6. The callback `/account/promotions?reference=…` verifies with the backend; a URL success flag cannot grant benefits. Confirm Test order/purchase/entitlement state and TEST-labelled preview, then check the independent webhook receipt/worker and reconciliation logs. Close the local browser/server during a second test to confirm cloud webhook processing remains independent; re-open history afterward.
7. Exercise failed/cancelled/abandoned checkout, repeat verification and webhook resend, cooldown, concurrent checkout, expiry, a real ad becoming unavailable, refund/dispute notices, and cross-user/anonymous denials. Initiate any test refund manually in Paystack and observe the signed event; app review notes do not issue refunds. Keep genuine historical adverts and accounting records. Do not seed fictional inventory or use a cloud cleanup test script.

The shipped environment example keeps checkout disabled and preview false. `THROTTLEHUB_PAYMENTS_ENABLED=false` disables **new initialization** while existing orders can still be verified/processed. Test-mode benefits remain isolated. Root `npm run dev:emulator` plus a real cloud webhook is not an end-to-end payment environment: the cloud worker cannot see local emulator orders. Automated tests use controlled Paystack providers and loopback Firebase only.

## Verification and remaining release work

Final automated results and logs are recorded in `audit/payments-test-results.md`. Checks include ZAR amounts/catalogue control, official API adapters with mocked transport, failures/abandonment/delayed payment, signature forgery/raw-byte changes/size limits, duplicate transaction IDs, cross-user/anonymous/admin boundaries, simultaneous callback/webhook, one fulfilment, expiry, bump/featured ranking, refund/dispute replay, partial refund/provider outage, quotas, normal accounts and Firestore default-deny. No external success is inferred from these tests.

Before Live approval: finish real Test checkout/webhook/reconciliation acceptance; verify current Rules/index READY/IAM/provider configuration; establish staffed refund/dispute/support and reconciliation procedures, alert delivery and retention/accounting policy; choose appropriate distributed public endpoint abuse protection, budgets and spend monitoring; confirm customer terms/receipts and support contact. This implementation conservatively keeps resolved disputes/partial refunds in manual review and never auto-restores reversed benefits. It does not automate refund payouts or certify accounting/tax policy. Existing platform launch limitations from the security audit still apply.

Monitor payment review records, `paymentWebhookEvents*.status=needs_review`, repeated processing failures, due-order backlog, scheduler failures, unavailable paid orders and provider errors. Receipt retries are capped at 20 before review; unresolved verification is escalated after seven days. Configure Cloud Logging/Monitoring alerts and an operator response before launch; no alerting/billing configuration was created. Bounded reads and maxInstances are not a spending cap.

After **separate explicit Live approval**, create the Live secret using the same secret command with `THROTTLEHUB_PAYSTACK_LIVE_SECRET_KEY`, set the live gate in authorized server/Functions configuration, and selectively deploy only the three Live exports using the same codebase-qualified format. Configure the Live webhook and approved HTTPS callback origin, set local/hosted server mode to `live`, disable Test preview, and run a separately authorized small real-money acceptance. Do not enable Live by merely changing a client value. No such step was performed here.

Rollback/incident response: stop new checkout initialization first; keep verification and reversal processing available when safe so already-paid orders are not abandoned. Preserve orders/purchases/events, resolve owed service/refunds and review pending receipts. Restore reviewed compatible application/Functions code through a separately approved selective release. Never delete payment history, disable the Test/Live boundary, open Rules or assume a website rollback reverses a Paystack charge. Existing public visibility independently excludes expired/unavailable records.

## Changed/new files

- `payments-functions/`: dedicated package/lock/TypeScript config, six Functions exports, shared catalogue/Paystack adapter/order/entitlement/webhook/reconciliation core, README.
- `firebase.payments.json`: isolated Functions-only codebase/configuration; root `firebase.json` and content Functions remain untouched.
- Next server: `src/lib/payments.ts`, `promotion-client.ts`, `promotion-readers.ts`; `src/app/api/promotions/route.ts`, `src/app/api/admin/payments/route.ts`.
- UI: `src/components/promote-listing.tsx`, `src/app/account/promotions/page.tsx`, `src/app/admin/payments/page.tsx`; owner actions in Account/detail; badges in cards; homepage honest featured section/deduplication and scoped styles.
- Ranking/lifecycle: `src/lib/marketplace-search.ts`, `src/lib/server.ts`, `src/lib/models.ts`, `src/lib/listing-lifecycle.ts`.
- Review/build: `scripts/indexes.mjs`, `firestore.indexes.json`, generated index catalogue, comment in `firestore.rules`, `.env.cloud.example`, `.gitignore`, TypeScript/ESLint config and Next's shared `.js`→TypeScript build resolver.
- Tests: `tests/payments.test.ts`, `tests/payment-api.test.ts`, `tests/payment-integration.test.ts`, emulator test exclusion; this report and evidence. Existing uncommitted work was preserved; no commit/push was made.

Primary references: [Paystack Initialize/Verify](https://paystack.com/docs/api/transaction/), [signed webhooks/events](https://paystack.com/docs/payments/webhooks/), [refunds](https://paystack.com/docs/api/refund/), [disputes](https://paystack.com/docs/api/dispute/), [Firebase codebase isolation](https://firebase.google.com/docs/functions/organize-functions), [secret bindings](https://firebase.google.com/docs/functions/config-env).
