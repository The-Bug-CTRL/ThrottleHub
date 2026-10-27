> Current localhost/private-cloud plan: [FIREBASE_PRIVATE_TEST_READINESS.md](FIREBASE_PRIVATE_TEST_READINESS.md). Latest verification: **169 tests,29 files;155 prepared indexes**. This document preserves its earlier audit snapshot where superseded. No cloud deployment was performed.

﻿# Final Firebase integration: NO-GO for public launch

23 October 2026. Project **throttlehub-9d6b9**; workspace `E:\ThrottleHub_codex_code`.

The current application, Firestore Rules, Storage Rules and 160-index catalogue form one locally tested configuration. **157 tests passed, 0 failed, across 25 files.** Public launch remains blocked by the operational and security items below. No deployment, production write/deletion, role change, demo inventory, commit or push was performed. Existing uncommitted work was preserved.

## Final permissions and changes

- **Firestore:** `profiles/{uid}` accepts the application's explicit `accountType` and exact `business` map: `name`, `logoURL`, `description`, `category`, `website`, `phone`, `email`, `hours`. Personal profiles cannot retain business data. New profiles must select a type; legacy profile edits remain compatible without permitting a legacy-shape business-name bypass. Owner identity and creation time remain protected. Business contacts are deliberately public storefront information; private Auth/account email is not automatically exposed. Extra verification/role/admin fields are denied; authorization remains verified custom claims. Account type never grants staff powers. Public listing seller type is derived by the trusted service and frozen at first publication.
- **Firestore video records:** clients cannot create/change ready records, validation flags, private quotas, history or cleanup jobs. Direct client publication is denied. Existing marketplace, messaging, reviews, forum, notifications, stolen reports and editorial ownership/role restrictions remain enforced. Both policies remain default-deny.
- **Storage staging:** actual paths are `listing-video-uploads/{uid}/{listingId}/{videoId}.mp4`. Creation requires a server-issued, unexpired one-hour slot, same UID/listing, active account and still-eligible parent. Missing parents alone do not grant upload access. Cross-owner, forged-slot, expired-slot, oversized, wrong-type and overwrite attempts are denied. Files are limited to 100 MiB and MP4. Owners can delete eligible abandoned staging files; processing/current accepted files are protected.
- **Accepted videos:** `listing-videos/{uid}/{listingId}/{videoId}.mp4` is server-write-only. Public SDK playback requires the exact current video on an eligible ZA/ZAR published/sold/expired/on-hold listing. Owner/admin reads remain allowed. Playback route checks public listing eligibility and the accepted generation. Removal/restriction trusted cleanup deletes accepted and staged video paths; sold/expired records retain media. Token playback URLs are bearer capabilities; deletion is the revocation mechanism, not a status change alone.
- **Trusted publication/relisting:** motorcycle taxonomy branches require server-validated same-owner/same-listing video records. Validation checks actual MP4 bytes, H.264/AAC streams, 15–60 seconds, dimensions, full decoding and metadata-stripping remux; petrol requires audio. This final review additionally checks the accepted Storage object's **existence, generation, byte count and MIME** while the transaction holds the ready-record version. Missing/replaced/metadata-changed objects fail closed. Parts are exempt; incomplete drafts remain possible. No browser flag can substitute for validation. This does not prove the depicted bike/engine is genuine.
- **Staging limits:** server transactions enforce six starts per rolling hour plus twelve per rolling day across arbitrary listing IDs. Each slot allows one object, at most 100 MiB; discarding does not refund starts. Validation concurrency is capped at two per server process. Existing maintenance claims unreferenced records older than 24 hours transactionally before object deletion, retains current historical references and defaults to dry-run. **A monitored production schedule is not installed.** These controls are not a distributed whole-platform quota.

Final rule implementations: [Firestore](firestore.rules), [Storage](storage.rules). Contracts: [85-row permission matrix](FIREBASE_PERMISSION_MATRIX.md). Exact index definitions: [catalogue](audit/firebase-index-catalogue.md). The mechanical inventory currently has 632 candidate calls in 51 source files; this is not a count of tested permissions.

## Automated verification

| Check | Result |
| --- | --- |
| Full isolated Emulator Suite / application integration | **157 passed; 0 failed; 25 files; exit 0** |
| Seller/video suite | 19 passed, including actual FFmpeg inspection/remux and end-to-end publication |
| Regression coverage added in this review | Missing/replaced/metadata-changed accepted file, missing server bucket, expired video access/relist denial, daily arbitrary-ID quota, parent restricted after slot issuance |
| Historical marketplace media | Photo history tests pass; sold video retained and readable; expired video readable and cannot relist after deletion; historical cleanup references retained |
| TypeScript | Passed |
| ESLint | 0 errors; 18 existing warnings |
| Isolated production build | Passed, exit 0; user's development `.next` preserved |
| Local Firebase config | Passed, explicit cloud target/bucket confirmed |
| Cloud verifier | Partial: project/Web app/database/bucket match; exits 1 because both provider reads return HTTP403 |
| Read-only cloud policy backup | Completed, exit 0; two releases and index/bucket metadata exported |
| Composite indexes | 160 prepared; cloud has 0, therefore none confirmed READY |

Evidence: `.tools/final-integration-tests.log`, `.tools/final-integration-lint.log`, `.tools/final-integration-build.log`; [cloud comparison](audit/firebase-cloud-comparison-2026-10-23.json). Tests run only against loopback `demo-throttlehub-tests`; negative permission traces are expected passing assertions. Static rendering tests are not browser/device acceptance. Emulator success does not verify real composite index readiness.

Reproduce with Node on PATH:

```powershell
npm run typecheck
npm run lint
npm run test:integration
npm run build
npm run firebase:check
npm run firebase:verify-cloud
node scripts/backup-firebase-security.mjs
```

This tool shell uses bundled Node at `.\.tools\node-v22.23.4-win-x64\node.exe`. The full test runner also needs executable FFmpeg/ffprobe and Java. The recorded production build used `.tools/build-community-isolated.mjs` to avoid the running development build.

## Actual cloud comparison and rollback snapshot

Read-only check at **2026-10-23 19:26 UTC** confirmed the project ID/project number, registered Web configuration, Firestore Standard/Native `africa-south1`, and bucket `throttlehub-9d6b9.firebasestorage.app` in `AFRICA-SOUTH1` belonging to this project. Existing authorized credentials were used; none were invented, overwritten or printed. Provider configuration reads returned **HTTP403**, which establishes neither enabled nor disabled.

Backup completed at `.tools/cloud-security-backup/2026-10-23T19-26-23.165Z/COMPLETE.json`. All exported files were copied with SHA-256 equality checks into ignored, non-ephemeral `.secrets/security-backups/2026-10-23T19-26-23.165Z/`. Preserve that directory securely. Its `firebase.rollback.json` points to the actual exported prior sources using absolute local paths; update paths if moving the backup.

**Both currently deployed policies are initial deny-all policies**, different from the local application policies. Cloud index inventory is empty. The backup preserves the actual active release/ruleset IDs; it is not an assumed Git baseline. Bucket metadata reports seven-day soft-delete retention, which can retain deleted bytes for authorized recovery and billing. No cloud settings were changed.

## Outstanding public-launch blockers

1. **Upload/media abuse controls:** photo uploads still accept arbitrary absent listing IDs and have no trusted slot/quota; stolen media/evidence also lack comprehensive quotas. Video limits are per-account, not distributed global admission or Sybil prevention. Add platform abuse controls, budgets/alerts and appropriate App Check integration. Do not enable enforcement before clients/backend support it.
2. **Trusted non-video validation/lifecycle:** listing photos and evidence/PDFs still rely on MIME/size rather than trusted decoding/inspection. Photo existence is not checked at publication. Complete orphan handling and archived/unpublished stolen/news/private-evidence token/retention policy. Video maintenance is implemented/tested but needs a separately approved monitored schedule, retries and cleanup-failure alerting. Without scheduling, daily upload limits do not bound lifetime accumulation.
3. **Runtime provisioning:** ensure the existing Next.js server actually has maintained FFmpeg/ffprobe, writable temporary disk (400 MiB plus headroom), adequate resources and the 300-second route allowance. Two-process-local concurrency slots do not bound a horizontally scaled deployment.
4. **Live verification/release:** confirm Email/Password and Google providers, authorized domains, least-privilege IAM and private-file CORS with an authorized operator. Deploy approved indexes and wait READY. Test real Google/email/persistence and genuine content with designated accounts in fresh sessions, including foreign-user denial. No live acceptance writes were authorized/performed here.
5. **Account privacy operations:** deletion/export, retention/legal holds and coordinated treatment of historical adverts, messages, reviews/evidence/follow edges remain unfinished. Prior audit limitations remain applicable where not superseded by this report, including bounded-list and timestamp coverage gaps.

Do not treat the locally passing suite as certification of zero production errors. Do not solve failures by opening rules.

## Prepared release order — approval required, nothing executed

First resolve the blockers, preserve a fresh completed backup, verify the chosen server runtime, and agree a maintenance window/compatible application release. The new application and rules must ship together: old cached clients lack mandatory account/video and forum reply payloads. Do not activate only new policies against an old frontend. Site deployment remains separately approved and no Hosting/Functions command is included here.

```powershell
Set-Location E:\ThrottleHub_codex_code
# 1. Approved index creation only; review any deletion prompt rather than accepting blindly.
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.json --project throttlehub-9d6b9 --only firestore:indexes
# 2. Wait for all 160 required indexes to be READY; inspect a fresh backup/index inventory.
node scripts/backup-firebase-security.mjs
# 3. In the coordinated application/policy release window, after separate approval:
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.json --project throttlehub-9d6b9 --only firestore:rules
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.json --project throttlehub-9d6b9 --only storage
```

The default alias remains `demo-throttlehub`; every cloud mutation command explicitly selects `throttlehub-9d6b9`. With Node absent on PATH, replace each leading `node` with `.\.tools\node-v22.23.4-win-x64\node.exe`. Install any approved cleanup scheduling separately; never silently append cleanup/apply to deployment. Fresh authenticated/unauthenticated acceptance must verify histories, video playback, profile privacy and foreign reads/writes after rule propagation.

## Safe rollback

Stop affected writes through the agreed operational maintenance process, preserve incident evidence, and identify whether application or policy compatibility failed. Do not delete indexes/data or temporarily open permissions. Restore a compatible application through its separately approved release process.

The prepared prior-policy rollback restores the actual **deny-all** baseline. It safely closes client access but deliberately makes the marketplace unavailable; it does not restore a previously functioning deployed application. Review and obtain explicit rollback approval first:

```powershell
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config .secrets/security-backups/2026-10-23T19-26-23.165Z/firebase.rollback.json --project throttlehub-9d6b9 --only "firestore:rules,storage"
```

Keep added indexes. A policy rollback does not undo Admin SDK writes, which bypass Rules; stop affected trusted routes operationally as well. Deny-all Rules also do not revoke existing bearer download URLs; handle any required capability revocation through a separately reviewed media process. It does not restore already deleted files or reverse data mutations. No cleanup or destructive migration is part of this release plan. Allow rule propagation, reload old tabs and verify fresh sessions before reopening traffic. Prefer a reviewed roll-forward when rollback would reintroduce a known flaw.
