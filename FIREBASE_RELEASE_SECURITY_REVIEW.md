# Final Firebase security review and release preparation

28 October 2026. Workspace `E:\ThrottleHub_codex_code`; intended project **throttlehub-9d6b9**.

**Local security tests pass. Deployment is conditional, not an unconditional public-launch GO.** Existing contact records require a reviewed migration/inventory before the new privacy policy is activated, and live policies/index readiness could not be verified without authorized ADC. No deployment, live document migration/deletion, role change, secret change, Git commit or push was performed. Existing uncommitted work was preserved.

## Findings and corrections

| Finding | Correction / disposition |
| --- | --- |
| Public `profiles` documents could contain a phone without a separate sharing decision | New `profileContacts/{uid}` is API-only. Profile setup/edit stores contact values there. Public phone copies require `contactPhonePublic: true`; default is false. |
| Business phone/email were labelled public but lacked an independent opt-in | Both default private. Account settings offer a separate `businessContactsPublic` checkbox. Public business objects have empty phone/email unless opted in. New business registration keeps contacts private; sharing can be enabled later in account settings. |
| Legacy phone/business contact values could be returned by public server readers even without explicit consent | Public projection removes unconsented contacts. Seller page uses it and selects the consent flag; phone-reveal/statistics helper also requires consent. Existing data is not opted in automatically. |
| Rules cannot mask a sensitive field inside a readable document | Public reads of legacy documents containing unconsented contacts now fail closed; owner/admin reads still work. Writes require consent for nonempty public contact values. **This is a deliberate compatibility gate requiring migration before rollout**, not a claim that Rules hide individual fields. |
| Support 503 suppressed the stage/provider information needed to diagnose it | Static-stage server diagnostics now report safe code/classification and a Firebase index-creation URL when supplied. Raw messages, tokens, UIDs, guest keys, ticket bodies and arbitrary request parameters are not logged. Visitors keep a generic error. |
| Support Auth failures conflated credential/IAM outages with invalid customer sessions | Known revoked/expired/invalid/disabled-user errors return 401; unexpected Admin/service failures return 503 and are diagnosed server-side. |
| Private form state could remain from the previous account during identity switching | Clear contact/business state and render the profile form only when its loaded owner matches the signed-in UID. TypeScript/lint/build checked; actual browser switching remains part of acceptance. |
| Old component assertion expected the former public-email wording | Updated the assertion to require private-by-default wording. Phone-reveal positive fixtures now explicitly opt in; new negative tests cover legacy/no-consent/private data. |
| Live verification unavailable | Read-only backup utility failed closed for missing authorized ADC. No fresh backup or current deployed-policy comparison is claimed. Earlier completed backups were preserved. |

These changes preserve unrelated trusted profile metadata and original profile/listing creation timestamps. Owner GET/setup recovery reads private contacts but does not rewrite existing records. Explicit profile saves perform the separation transactionally. Private Auth email is not copied to public fields. Consent flags convey no staff or verification privileges.

Firebase documents the whole-document read boundary and the fact that server clients bypass Rules: [field access and server clients](https://firebase.google.com/docs/firestore/security/rules-fields). Public profiles, SSR projections and Rules therefore need to ship consistently.

## Exact Support Centre query and 503 conclusion

For an ordinary signed-in customer, `GET /api/support?&sort=` executes:

```typescript
db.collection("supportTickets")
  .where("ownerId", "==", verifiedUid)
  .orderBy("updatedAt", "desc")
  .orderBy("__name__", "desc")
  .limit(30)
```

It uses collection scope, not collection-group scope. Later pages validate an authorized cursor document and use `startAfter(cursor)`. The required composite is **ownerId ASC, updatedAt DESC, __name__ DESC**, already present locally. An administrator's unfiltered recent queue has no owner predicate and uses the ordinary updatedAt/document-ID descending index. Filtered/oldest staff queues use the prepared support composites.

The literal empty query separator and empty `sort` are valid and select recent ordering. A new emulator regression invokes this exact URL with an owner who has no tickets or counter document and receives **200 with an empty list**. Missing collections and missing `supportSignals` documents are not this error. Counters are not queried by the list API. No filter, owner check or paid ranking was removed.

**The live incident's root cause remains unconfirmed.** A missing/not-ready cloud composite is a plausible cause for a customer query, while server credentials/IAM/configuration are other possibilities. Local config check reports complete Web settings but no configured server credential path; the backup could not obtain ADC in this tool session. This does not prove the separately running IDE server has the same credential environment. Admin bypasses Firestore Rules, so opening Rules is not a solution.

Restart the compatible local server, retry `/help` once, and inspect `[Support]` in that server's terminal:

- `identity/admin-initialization` with `admin-credentials`: repair approved server ADC/configuration.
- `customer-list: ...` or `staff-list: ...` with `index-required-or-building`: verify the exact indicated index in this project, deploy the reviewed catalogue after approval and wait READY.
- `iam-permission`: check the runtime identity's Firestore access, not client Rules.
- `backend-error`: inspect the safe code and investigate the relevant backend condition. Code 9 alone is not labelled a missing index.

The log does not return its index link to visitors. Firebase's missing-index errors can provide an index creation link: [index management](https://firebase.google.com/docs/firestore/query-data/indexing).

## Complete local authorization review

Both complete policy source files were reviewed alongside the API/service paths. The existing default-deny catch-all remains. There are no `privateTesters` requirements in normal application code or these normal-operation policies; old private-overlay files remain separate historical tooling and are not the release target.

| Area | Reviewed boundary / automated evidence |
| --- | --- |
| Registration/Auth | Existing Firebase Auth and verified-token profile setup; normal registration without tester membership remains covered. Real Google/provider domains and email delivery are not reverified by emulators. |
| Profiles/business | Owner-scoped edits, schema allowlists, immutable creation time, no client admin/verified fields; new private contacts denied to all client SDK identities, including admins. Owner API access and public-consent behavior tested. |
| Listings | Owner draft writes only; trusted publish/edit/relist lifecycle checks actual identity, status and restrictions. Foreign writes/direct publication denied. Historical timestamps/rankings unchanged. |
| Video requirement | Trusted service uses actual motorcycle taxonomy, validates same-owner/listing ready video and actual accepted object; nonmotor categories need no video. Real FFmpeg and history regressions pass. Rules do not substitute for byte validation. |
| Photos/videos | Listing photo writes and accepted video writes are server-only. Video staging requires an unexpired issued slot, ownership, eligible parent, type and size. Public current/historical playback follows listing eligibility; foreign overwrite denied. |
| Messages | Fixed participants, ownership of current listing, sender identity and timestamp bounds; nonparticipant reads/writes denied. |
| Forum | Active accounts, locked/hidden parent checks, cooldown and actual reply-linked activity bump; moderator role scoped to moderation. |
| Stolen reports/evidence | Pending/reviewed owner boundaries; moderator access to evidence; foreign paths/approved photo replacements denied. Evidence MIME/size checks are not byte validation; see residual blockers below. |
| News/events/imports | Official editorial writes admin-only; published records public, drafts protected. Imported News/Race/Video data uses bounded Admin-backed filtered projections; source-health/raw collections remain client default-deny. No ingestion or feed infrastructure changed. |
| Payments/promotions | Raw orders, receipts, entitlements, limits/audit are client-denied. Authenticated API projections, server-priced purchases, HMAC verification, trusted fulfilment, idempotency, TEST/LIVE separation and reconciliation regressions pass. Moderator finance access denied. |
| Support | API-only ticket ownership/admin checks; private notes/activity staff-only; private image proxy with actual decoding; no direct screenshot SDK access. Own/admin signal gets only, no signal listing/writes. Moderators cannot read the staff signal or acquire staff queue scope. |
| Roles/restrictions | Authority remains verified custom claims, never business/account fields. Suspended users cannot use guarded marketplace/upload/message/forum paths. Support and profile recovery intentionally remain available for assistance/appeals; suspension is not an Auth ban. |

Storage source starts with valid `rules_version = '2';`, contains no copied Markdown/HTML wrapper and compiled in the full emulator suite. **No Storage source change was required in this review.** Its existing support-image denial, protected accepted media and evidence controls were retained.

## Index catalogue

Confirmed **202 unique composite definitions = 171 existing marketplace/Paystack + 31 support**. No additions, deletions or replacements in this review. The exact enumerated definitions remain in `audit/firebase-index-catalogue.md` and `firestore.indexes.json`; `scripts/indexes.mjs` remains their generator.

Support definitions: every nonempty subset of `[ownerId, status, category, priority]` (15 subsets), followed by either `updatedAt DESC, __name__ DESC` or `waitingSince ASC, __name__ DESC` = 30; plus unfiltered `waitingSince ASC, __name__ DESC` = 1. Equality fields use ASC. Default single-field indexes are also required. The collection is `supportTickets`, scope COLLECTION. Messages/notes/activity paginate by createdAt DESC/document ID DESC within a ticket. No collection-group permission was added.

**Cloud presence/readiness is unknown this session.** Neither the old 155 nor 171 deployment reports prove these 31 support definitions are live. The existing checker compares a fresh completed backup with local definitions and must pass before release. Do not accept an unexpected CLI prompt to delete unmanaged indexes.

## Mandatory legacy-contact migration plan — not executed

Do not deploy the privacy Rules alone against unreviewed legacy profiles. Public SDK consumers may be denied entire legacy profiles until contacts are separated, including seller cards/connections; Google/profile client updates can also need the compatible API flow.

1. With approved credentials and explicit migration authorization, inventory profiles for nonempty contactPhone and business phone/email with no corresponding true consent flag. Also review legacy unexpected private fields using the previous audit's schema inventory guidance. Export an encrypted/access-restricted backup of affected records and matching private-contact records; do not place personal data in logs, Git or this report.
2. Prepare a transaction-based, dry-run-first migration for that reviewed UID set. Read both profile and `profileContacts/{uid}` before writes; detect concurrent edits/private-contact conflicts and skip for review rather than overwriting. Preserve profile ID, creation time, business description/name and unrelated metadata. Copy legacy contacts to the private document; remove the public phone and blank public business phone/email; default both consent flags to false. Never infer consent from an old field label. Preserve new explicitly opted-in records and newer private values.
3. Review the dry-run counts and exact changes; obtain migration approval. No migration/apply command was fabricated or run here. Perform the approved migration and compatible app/policy cutover in a maintenance window. Existing owners may instead deliberately save their profile through the new API; do not silently trigger migration on login/GET.
4. Verify no unconsented public contact copies remain. Confirm owner editing/recovery, consent on/off and phone reveal with designated accounts. Do not restore public copies during rollback. Complete remaining legacy-field/schema review before broad public launch.

Until that work is approved/completed, use isolated emulators for privacy testing. No historical listings, messages or files need deletion for this change.

## Administrator claim check

`/admin/support`, staff notifications and finance require **admin: true**, not merely moderator. To inspect an existing account without changing it, use its exact Auth UID with approved server ADC:

```powershell
node scripts/check-admin-claim.mjs --uid YOUR_EXISTING_AUTH_UID
```

This new read-only utility verifies the configured cloud target, rejects Auth-emulator mode, calls Auth getUser and prints only project/admin/moderator/disabled booleans. It never sets claims or prints tokens. Syntax checked; live success path unverified because ADC is unavailable. Do not send a private key or ID token in chat. Have an authorized operator provide secure ADC and Auth user-read permission if needed. After any separately authorized future claim change, sign out/in or force-refresh the ID token before using the website; no claim change was made here.

## Verification and release limitations

**263 tests passed across 49 files** in the full isolated emulator/application suite. TypeScript `--noEmit --incremental false` passed. ESLint: **0 errors, 20 existing warnings**. Isolated production Next.js build completed successfully, exit 0; the user's running `.next` was preserved. Evidence: `.tools/release-security-tests.log` and `release-security-tests-exit.json`; `.tools/release-security-lint.log`; `.tools/release-security-build.log` and `release-security-build-exit.json`. Local Firebase configuration check passed (with absent Admin credential-path warning); read-only cloud backup failed closed. Read-only claim utility syntax check and `git diff --check` passed.

The initial full run found one outdated component-copy assertion expecting “Public business email”; it was updated to assert the new private-by-default wording, rather than reverting the privacy change. No security assertion was weakened.

New coverage explicitly tests private contact defaults, opt-in/withdrawal, legacy denial without mutation, private contact SDK denial for anonymous/owner/foreign/admin, exact support empty-sort URL, real support notification listener allow/deny for owner/admin versus foreign/moderator/anonymous identities, credential versus session failures and sanitized diagnostics. Existing suites cover authenticated registration without testers, anonymous/owner/foreign/admin/moderator/suspended actors, payment records, media and private attachments.

Emulators do not certify cloud composite readiness or IAM. No live account/ticket/listing writes, browser acceptance, actual Google/email, App Check or deployed-policy tests were performed. The earlier browser-access limitation remains; no mobile/device pass is claimed here.

Remaining broader launch blockers from the earlier audits are not erased by this review: trusted stolen/news/evidence image/PDF inspection and upload quotas; token/retention/orphan lifecycle for those older media paths; monitored cleanup/retries; platform-wide abuse/egress controls; hosted FFmpeg/resource/timeouts; approved account/support data retention/export/deletion workflows; live Auth/IAM/CORS/App Check acceptance. Current numeric timestamp/audit coverage and moderator-to-staff restriction policy also retain earlier qualifications. Do not interpret passing authorization tests as certification of all possible production operations.

## Exact release order — operator only, nothing executed

Use the normal `firebase.json`, which maps `firestore.rules`, `firestore.indexes.json`, and `storage.rules`. CLI default remains the safe demo project, so every mutation explicitly names `throttlehub-9d6b9`.

```powershell
Set-Location E:\ThrottleHub_codex_code
npm run typecheck
npm run lint
npm run test:integration
npm run build
node scripts/check-firebase-config.mjs
node scripts/backup-firebase-security.mjs
```

Stop if backup/credentials fail. Preserve the fresh completed snapshot securely and compare its actual released sources to local policies. The existing `.secrets/security-backups/2026-10-23T19-55-47.187Z/COMPLETE.json` and earlier 19:26 backup are still present; those historical snapshots contain deny-all policies and zero indexes. They are **not evidence of current deployed state** and are not a substitute for a fresh backup now.

After explicit index approval:

```powershell
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.json --project throttlehub-9d6b9 --only firestore:indexes
node scripts/backup-firebase-security.mjs
node scripts/check-firebase-index-readiness.mjs
```

Repeat the read-only backup/readiness check while indexes build; proceed only when all required definitions are READY. Then resolve/approve the legacy migration above and coordinate the compatible Next.js app and Rules in a maintenance window. After explicit policy approval:

```powershell
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.json --project throttlehub-9d6b9 --only firestore:rules
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.json --project throttlehub-9d6b9 --only storage
```

Within that closed maintenance window, establish the new default-deny private-contact policy before copying any legacy contacts into the new private namespace; do not assume an unverified old policy protects a new collection. Then run only the separately reviewed/approved migration, activate the compatible application, verify the data and fresh-session acceptance, and reopen. Unsafe legacy public-profile reads may deliberately fail during this closed transition. Do not activate just one piece and reopen traffic midway.

These deploy full reviewed policy files, including prior uncommitted feature work. No Hosting, Functions or Paystack deployment is included. Next.js application release remains a separately approved operator step; for localhost restart the compatible code with `npm run dev`. If Node is not on PATH, replace `node` with `.\.tools\node-v22.23.4-win-x64\node.exe`.

Fresh-session acceptance: signed-out plus customer A/B and existing admin/moderator; verify public/private contacts and withdrawal, foreign denial, signup, real Google, support screenshot/messages/notes/signals, public phone counters, listings/history/video, and existing finance-denial paths. Verify support 503 is resolved with actual credentials and READY indexes. Do not use fictional live inventory or weaken Rules if a test fails.

Rollback: stop affected trusted routes as well as clients. Preserve evidence and use the **fresh actual deployed-policy snapshot**, with a reviewed `firebase.rollback.json` referencing those exported sources. Check that reverting does not republish private contacts or weaken permissions. After explicit rollback approval only:

```powershell
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config PATH_TO_REVIEWED_SNAPSHOT/firebase.rollback.json --project throttlehub-9d6b9 --only "firestore:rules,storage"
```

Keep indexes and data; do not reverse contact separation by copying private values back into public documents. Historical deny-all rollback would close client access, not restore a working marketplace, and would not stop Admin routes or revoke bearer URLs. Prefer roll-forward for privacy defects. This session cannot prepare a fresh actual-cloud rollback config because the backup could not authenticate.

## Files changed by this review

- `src/lib/profile-service.ts`: private contact storage, owner projection, consent-aware public projection, transactional edits.
- `src/lib/public-phone.ts`: require explicit publication consent for reveal/statistics.
- `src/app/account/page.tsx`, `src/components/seller-account-fields.tsx`, `src/app/seller/[id]/page.tsx`: private defaults, sharing controls and safe seller rendering.
- `firestore.rules`: consent-compatible validation/read guard and explicit API-only private contacts. Storage Rules unchanged.
- `src/app/api/support/route.ts`, new `src/lib/support-diagnostics.ts`: safe diagnostics and correct Auth infrastructure error handling.
- New `scripts/check-admin-claim.mjs`: read-only operator claim check.
- New `tests/release-privacy.test.ts`, `tests/support-diagnostics.test.ts`; updated `tests/support-api.test.ts`, `tests/support-integration.test.ts`, `tests/listing-engagement.test.ts`, `tests/seller-components.test.ts`, `vitest.config.ts`.
- This report. No index definitions, Paystack implementation, live configuration, `.env.local` or credentials were changed.
