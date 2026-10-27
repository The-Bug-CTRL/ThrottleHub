# ThrottleHub: controlled real-Firebase readiness

> Historical snapshot: private-tester approval and its generated overlays have been retired. Use [Normal marketplace access](NORMAL_MARKETPLACE_ACCESS.md) and the canonical root Rules files instead of this document's old activation instructions.

23 October 2026. Project **throttlehub-9d6b9**. First test URL confirmed by the owner: **http://localhost:3000**.

**Code is prepared for a small, supervised private cloud test; cloud activation is still blocked pending the manual steps and explicit deployment approval below. Public launch remains NO-GO.** No live configuration/data/role changes, deployments, scheduled task registration, commits or pushes were performed. Read-only metadata/pricing calls and local tests were used. Prior uncommitted work and completed backups were preserved.

**Final automated checks:169 tests passed across29 files; TypeScript and production build passed; ESLint0 errors/18 existing warnings.**

## Ready now

- One audited base configuration plus a **generated restrictive private overlay**, not independently maintained policies. `scripts/prepare-private-firebase.mjs` intersects every base allow condition with an enabled `privateTesters/{uid}` membership. Anonymous/unlisted/revoked clients cannot use Firestore or Storage, and clients cannot edit membership. Deploy using **firebase.private.json** for this test. Keep the ordinary public configuration un-deployed.
- Local `.env.local` now has server-only `THROTTLEHUB_PRIVATE_TESTING=true`; credentials were not overwritten. Listing/photo/video mutations and notifications independently check the same UID membership because Admin bypasses Rules. Public Admin-backed SSR/search are not gated by that membership: **keep this private test bound to loopback; do not publish it or expose it through a tunnel.** Hosted private testing requires an additional HTTP access boundary.
- Listing photos now use an authenticated, bounded server endpoint; **all direct client writes to listing-images are denied**. Same-owner/status/restriction checks and a transactional24-starts/24-hour-window quota span arbitrary IDs. Input is at most5MiB, JPEG/PNG/WebP signatures only,24MP decode limit, actual decoding/resizing/re-encoding and metadata stripping. Accepted JPEG objects are immutable to clients. New UUID photo references require trusted ready records and matching actual object generation/size/MIME when publishing/relisting. The browser still compresses first; server checks do not trust it.
- Trusted photo cleanup defaults to dry-run, claims unreferenced records older than24h and preserves current sold/expired photos. Claims conflict with publication reads; discarded/missing photos cannot publish. Media removal also removes private photo records. Existing video validation/quotas/history protection remain. Legacy non-UUID photos still follow their older compatibility contract and require inspection before public launch. Existing UUID photos without a trusted record must be uploaded again before editing/republication; historical reads, sale/hold/removal remain available.
- `ops/media-maintenance.ps1` prepares locking, structured logs, nonzero failure exits and combined video/photo scans. Schedule/retry instructions are in [ops/README.md](ops/README.md). **No scheduler or alert delivery is installed.** Run a supervised dry-run after approved indexes are READY; apply remains separately approved.
- Email-login profile recovery now supports approved/pre-created Auth identities and interrupted registration without overwriting an existing profile. Choose Personal/Business when completing a missing profile. Real provider/browser acceptance remains necessary.

## Index review and costs

**160 original − six unused + one photo-cleanup index =155 prepared.** No exact duplicates. Removed five stolen-report filter indexes lacking country (actual public queries always add ZA) and a listing document-ID composite whose old caller now uses a direct document read. Preserved all active search/category/province/sort combinations and the conservative combined-filter families. Potential equality-merge reductions need cloud query-plan evidence before removal. See the [full review and storage estimates](audit/firestore-index-review.md) and [155-entry catalogue](audit/firebase-index-catalogue.md).

Cloud inventory: **zero composite indexes**, so155 planned definitions still need creation/readiness verification. `scripts/check-firebase-index-readiness.mjs` compares exact definitions/directions against a completed backup less than15 minutes old, reports missing/non-READY indexes and exits1 until all planned definitions are READY. It does not delete unmanaged indexes or mutate cloud services. Emulators do not certify index readiness.

Verified Johannesburg Standard catalogue rates, before free quota/discounts: **$0.031/100,000 reads; $0.094/100,000 writes; $0.010/100,000 deletes; $0.156/GiB-month database/index storage**. A document set/update is one billed write, not one billed write per composite entry; fanout still increases storage/internal work/latency. With350 prefix tokens and a fully populated deep-category advert, the40 search-array composites can generate14,000 entries, plus42 scalar entries and single-field indexes. An illustrative10,000-advert model at100 tokens and160–320 bytes/entry gives roughly6–12GiB of composite indexes, **$0.94–$1.88/month**, before other storage. This is an assumption-based estimate; long paths/values may cost more. [Pricing evidence](audit/firestore-pricing-2026-10-23.json), [Firestore billing](https://firebase.google.com/docs/firestore/pricing).

Media delivery is likely the larger bill:100 videos at20MiB with ten complete plays/month give approximately **$2.38/month** combined live storage/egress at the previously verified Johannesburg storage rate0.020/GiB-month and example internet egress0.12/GiB, excluding operations, processing, photos, seven-day soft-deleted bytes, taxes and discounts. Ten such clips are about$0.24;100MiB clips multiply volume by five. Localhost adds no new hosted Next.js runtime charge. No actual production hosting price/runtime was verified; App Hosting minimum0/maximum2 instances is not a spending cap. [Media pricing evidence](audit/video-pricing-2026-10-23.json), [Cloud Storage pricing](https://cloud.google.com/storage/pricing).

Create alerts-only budgets at operator-chosen thresholds (for example$5/$10/$25 for the private test), inspect actual usage daily, and stop the local server/test membership when not testing. Alerts-only budgets do not stop spending; separately review supported spend controls/quotas. Search can read up to128 candidates for eight results; explicit document-ID ordering can also incur index-entry reads. Include private-membership Rule lookups, upload/validation retries and cleanup scans in usage monitoring. [Budget behavior](https://docs.cloud.google.com/billing/docs/how-to/budgets).

## Actual environment and backup

- Real project/Web app/Firestore Standard Native Johannesburg/bucket ownership verified read-only. Bucket: `throttlehub-9d6b9.firebasestorage.app`, `AFRICA-SOUTH1`.
- Fresh completed policy/index/bucket backup: `.tools/cloud-security-backup/2026-10-23T19-55-47.187Z`. Hash-verified copy and actual prior-policy rollback config: **.secrets/security-backups/2026-10-23T19-55-47.187Z/**. Original19:26 snapshot is also preserved. Both active deployed policies are still **deny all**.
- Bucket has **no CORS configuration**, uniform bucket access disabled, public-access-prevention inherited, seven-day soft delete. Inspected bucket IAM bindings have no allUsers/allAuthenticatedUsers principals. This does not certify inherited project IAM or existing object ACLs.
- Email/Password and Google configuration reads returnedHTTP403; enabled/disabled status is unknown. App Hosting backend inspection also returnedHTTP403; a backend's existence/runtime is unverified. Evidence: `.tools/cloud-readiness/latest.json`.
- Local runtime probe passed: Node22.23.4, FFmpeg/ffprobe9.0.1, writable temporary directory and about14.6GiB free. Full emulator tests actually decode/remux videos and re-encode photos. The repository's apphosting.yaml only sets minInstances0/maxInstances2; it does not provision FFmpeg, memory, CPU, disk or prove timeouts. Public hosting still needs maintained binaries, writable temporary space/memory headroom, process execution, resource/concurrency limits and a verified300-second video route allowance. Do not infer those from maxDuration alone. [App Hosting runtime configuration](https://firebase.google.com/docs/app-hosting/configure).

## Manual steps blocking private cloud testing

1. In Firebase Console, select **throttlehub-9d6b9 → Authentication → Sign-in method**. Confirm/enable Email/Password and Google; Google needs the correct support email/consent. Under Settings → Authorized domains, confirm **localhost**; add127.0.0.1 only if using that hostname. Domain entries contain no scheme/port. Do not add wildcard origins or unrelated domains. Provider/console edits require your approval and an authorized operator; none were made here.
2. Designate two real test identities. Record their exact Firebase Auth UIDs. Pre-create the email identity through an approved Console action, or allow initial signup to create Auth only; it will initially be denied data access. For Google, an initial popup can similarly create the Auth identity before membership approval. Then, using an approved Console/Admin action, create **privateTesters/{UID}** with **enabled:boolean true** for each. These documents confer no admin role. Retry sign-in and select Personal/Business to create a missing profile. No UID/account/membership was invented or created by this work.
3. Review project IAM, inherited storage permissions and default/existing object ACLs; require no public principals. Keep server ADC local/server-only. The runtime needs scoped Firestore data access, bucket-scoped object operations and Auth user-read permission for revocation checks, not Owner/Editor/admin-role provisioning. Use operator/deployment credentials separately. Have an authorized operator verify Storage's Firestore-rule lookup service permissions. Auth/App Hosting inspection requires appropriate read permissions; do not grant broad Owner merely to removeHTTP403.
4. Apply the reviewed localhost CORS file only after approval; CORS is not an access-control substitute. Firebase Console has no equivalent arbitrary CORS editor: use an authorized local gcloud CLI or Cloud Shell with the file uploaded. `ops/storage-cors.localhost.json` limits origins to localhost/127.0.0.1:3000 and read methodsGET/HEAD. Listing-photo uploads are same-origin to Next.js; video/evidence SDK previews still need live CORS verification. [Cloud Storage CORS configuration](https://docs.cloud.google.com/storage/docs/using-cors).
5. Approve index/private-policy activation, wait for indexesREADY, restart the compatible local app and run the two-account test below. Keep this first test small and supervised with genuine, non-sensitive owned content. Do not upload third-party PDFs or confidential evidence while inspection/retention remains unfinished.

## Exact activation order — NOT EXECUTED

Run local/read-only preparation first:

```powershell
Set-Location E:\ThrottleHub_codex_code
node scripts/prepare-private-firebase.mjs
npm run firebase:check
npm run firebase:verify-cloud
node scripts/inspect-firebase-readiness.mjs
node scripts/check-media-runtime.mjs
node scripts/backup-firebase-security.mjs
```

HTTP403 verification gaps require manual operator confirmation; do not interpret a failed verifier as success. Preserve the new completed backup securely before mutation. After explicit approval for cloud configuration changes, perform:

```powershell
# 1. Create reviewed indexes. Do not accept an unexpected deletion prompt.
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.private.json --project throttlehub-9d6b9 --only firestore:indexes
# 2. Repeat read-only checks while building; proceed only when the checker exits0.
node scripts/backup-firebase-security.mjs
node scripts/check-firebase-index-readiness.mjs
# 3. Approved localhost CORS update; operator completes providers/UID membership steps above.
gcloud storage buckets update gs://throttlehub-9d6b9.firebasestorage.app --project=throttlehub-9d6b9 --cors-file=ops/storage-cors.localhost.json
# 4. Stop old local app, activate compatible private policies, then restart new app.
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.private.json --project throttlehub-9d6b9 --only firestore:rules
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.private.json --project throttlehub-9d6b9 --only storage
npm run dev
# 5. Read-only cleanup inventory after indexes are READY.
.\ops\media-maintenance.ps1
```

No website/backend/Functions deployment is needed for localhost. Public hosting/application activation is a separate later approval after its blockers are resolved. Retain `THROTTLEHUB_PRIVATE_TESTING=true`, cloud-mode project confirmation and unset emulator endpoints. A terminal without Node on PATH can replace each leading node with `.\.tools\node-v22.23.4-win-x64\node.exe`. Never deploy ordinary firebase.json public rules as a shortcut for private-testing errors.

## Two-account acceptance, monitoring and rollback

Use separate browser profiles A/B, plus a signed-out session. Check real email login/reset/logout and Google popup, reload persistence, profile recovery, account type/location/avatar and personal/business public fields. With A's genuine item, upload a valid photo/video, publish/search by province/category, and check the original URL/photo/video through hold/expiry/sold. Validate that B cannot edit/delete A's item, A cannot edit B's profile, a third unlisted UID/anonymous SDK cannot read/write, and a client cannot set admin/verified flags. Exercise participant messaging, bell state, favourites/follows, two-way-interaction review, forum lock/cooldown and private report/evidence access using known non-sensitive files. Do not publish fictional inventory or grant staff claims for convenience. Test official editorial/moderation operations only with a separately approved existing staff identity.

Inspect server5xx/429, validation failures, cleanupPending and read-only cleanup summaries, Firebase usage/bucket egress and index status. Record results; these browser/live checks have **not** been performed. Do not delete genuine historical adverts as test cleanup. For an account export/deletion request, use [the operator workflow](ACCOUNT_PRIVACY_OPERATIONS.md); no automatic whole-account erase/export has been introduced.

On a security/compatibility incident, stop Next.js and remove/disable tester membership through an approved operator action. After explicit rollback approval, restore the actual saved deny-all rules:

```powershell
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config .secrets/security-backups/2026-10-23T19-55-47.187Z/firebase.rollback.json --project throttlehub-9d6b9 --only "firestore:rules,storage"
```

Keep indexes/data. Deny-all closes client access; it does not stop Admin routes, revoke existing bearer URLs or undo data/file changes. Stop the server and separately review required media capability revocation. Preserve/review prior CORS/provider configuration before any separately approved rollback of those settings; do not disable shared Auth providers blindly. Policy propagation and cached tabs require fresh-session verification.

## Still blocking public launch

Trusted stolen/news/evidence upload quotas and image/PDF inspection/quarantine; legacy/recordless media inventory and archive/unpublish/token-retention handling; installed reliable orphan scheduling with alerts/retries; distributed platform abuse controls/App Check integration and spend controls; hosted FFmpeg/runtime/private-access verification; approved retention/export/deletion policy and tested implementation; complete live IAM/Auth/CORS/browser acceptance. New photo/video controls do not certify all those features. The private cohort reduces exposure while these are completed; it does not make public launch safe.

Automated verification and source review evidence are in [current test results](audit/readiness-test-results.md), [permission matrix](FIREBASE_PERMISSION_MATRIX.md) and [index review](audit/firestore-index-review.md). Earlier audit reports are preserved historical snapshots where superseded here.
