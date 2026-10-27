# Normal marketplace accounts and Firebase Rules

27 October 2026. Project **throttlehub-9d6b9**; workspace `E:\ThrottleHub_codex_code`.

**Implemented and tested locally: accounts no longer need approval documents. Nothing was deployed or changed live.** The owner reports that private overlays were published manually in Console. Those live policies still need replacing after review. Authorized local Admin authentication also remains unconfigured; removing approval does not supply server credentials.

## Exact Rules files

- Firestore: **`E:\ThrottleHub_codex_code\firestore.rules`**.
- Storage: **`E:\ThrottleHub_codex_code\storage.rules`**.

`firebase.json` references these canonical files. **Neither contains a private-tester membership requirement.** Their audited authorization conditions are retained; this task only adds identifying comments to the base Rules. The restrictive overlays have been removed. Default-deny, authenticated ownership, participation restrictions, business schema, participant privacy and trusted custom claims remain. No blanket authenticated write or open test-mode policy was introduced.

Reviewed file SHA-256 values:

```text
firestore.rules  433DE2F1D35E03EAFEDEDA9CF271A6E22EC483E56F80860F3825989462A767FE
storage.rules    FBAFE2D3EB5E21C8706501F64D3F2EC3747A1E5FB4620BE09C9542F51D2F2B5B
```

## Implementation and security

Removed the approval helper/calls from profiles, listing mutation, photo uploads, running-video actions, seller stats and notifications. Engagement no longer has the special private-mode anonymous denial; only eligible public adverts can receive its strictly validated/deduplicated events. Optional supplied tokens are still verified. Removed the local/example environment flag; a stale inherited flag cannot reactivate a gate because its runtime code is gone. Credentials were preserved.

Retired `firebase.private.json`, `firebase-private/*.rules`, `scripts/prepare-private-firebase.mjs`, the helper and approval-only tests. Pre-removal local copies are in ignored `.tools/retired-private-mode-2026-10-27/`; these are **not a current cloud backup**. Existing `.secrets/security-backups` are untouched. No live membership documents were read/deleted; the application no longer uses them and unknown client paths remain default-denied.

Profiles remain **`profiles/{verified Auth UID}`**, with atomic create-if-missing and explicit Personal/Business onboarding. Returning logins do not write over existing profile selections, storefronts or creation dates. Explicit edits update the server timestamp. Payload UID/role/admin/moderator/verification/private Auth fields are rejected; Business is self-declared, never a staff or verification claim. Private Auth email is not copied. Intentional business contacts/public contact phone remain public. `users/{uid}` contains private saved data, not parallel account profiles.

An existing Auth account with a missing profile can retry **`/auth?setup=1`** or sign in normally. It does not need deleting/recreating. Registration waits for the profile commit before navigating; failures describe ordinary connection/setup problems.

Affected Admin routes retain these independent controls:

| Surface | Retained authorization |
| --- | --- |
| Profile API | Revocation-checked token, UID derived from token, strict field schema, atomic own-profile operations. |
| Listing mutations | Verified token/claims, trusted owner/status/schema checks, suspension restrictions, constrained staff actions, history and publication/media validation. |
| Photos | Verified UID; transaction owner/restriction checks; 24 starts/day; 5 MiB/24 MP limits; actual decode/re-encode; ready record/generation checks; no direct Storage writes. |
| Running videos | Verified UID; owned expiring slot; six starts/hour and twelve/day; 100 MiB MP4 limit; FFmpeg validation; accepted generation/existence checks; server-only accepted writes. |
| Seller stats | Verified caller must own the advert; raw visitor markers/totals stay private. |
| Notifications | Verified UID scopes feed and read-state; request cannot select another account. |
| Public content | Existing bounded public projections for marketplace/reviews/news/races/YouTube; no arbitrary collection reader or source-health feed. |

Messaging/favourites/evidence remain private under the base Rules; accepted listing videos cannot be replaced by clients. Public profiles contain intentional public fields. Historical sold/expired/on-hold advert access is retained. Imported content is served through the safe Admin readers; its raw collections were not opened to client writes. No Functions, hosting, IAM or unrelated frontend features were changed.

## Test results

**205 tests passed across 38 files, exit 0**, on isolated loopback `demo-throttlehub-tests`. New real emulator Auth journeys cover email registration/login, missing-profile onboarding/editing, Google Business onboarding/re-login, and safe idempotence without approval documents. Negative cases deny forged identities/privileges, foreign edits, anonymous private access, direct publication, accepted-media replacement and forged staging. Existing messaging, suspension, quota, actual media processing and historical-data regressions passed.

TypeScript source/tests and the fresh isolated production build passed. The running development `.next` was preserved. ESLint: **0 errors, 19 warnings**. Local Firebase config check passed for the explicit project/domain/bucket; it does not verify live credentials or policies. Logs: `.tools/normal-access-tests.log`, `.tools/normal-access-build.log`, `.tools/normal-access-lint.log`.

No live Auth/Firestore/Storage behavior, actual Google popup, email delivery or browser persistence was verified. Browser access was previously denied and local Admin ADC remains unconfigured. No live test users, inventory, role changes or cleanup writes were made.

## Replace live Rules manually after review

These are operator instructions, **not executed actions**. Normal Rules allow intended public reads from any client, not just localhost. Review the remaining launch limitations below before publishing.

1. Stop the local app. In Firebase Console select **`throttlehub-9d6b9`**. Save copies of the currently active Firestore and Storage policies with project/bucket/date/release information. Older backups or retired local overlays are not proof of today's live policy.
2. Open **Firestore Database → Rules**, for **`(default)`**. Replace the entire editor with the full contents of **`E:\ThrottleHub_codex_code\firestore.rules`**. Paste source, not Markdown or a file path. Review/validate, then click **Publish** when ready. [Official Firestore instructions](https://firebase.google.com/docs/firestore/security/get-started).
3. Open **Storage**, select **`throttlehub-9d6b9.firebasestorage.app`**, then **Rules**. Replace the entire editor with **`E:\ThrottleHub_codex_code\storage.rules`**. Review/validate and click **Publish** when ready. These rules use Firestore lookups; an authorized operator must resolve any required Firebase cross-service permission prompt without weakening the policy. [Official Storage instructions](https://firebase.google.com/docs/storage/security/get-started).
4. Confirm both published editors contain the intended source and no membership helper. Updating only Firestore leaves Storage gated. Do not choose open test mode. Allow propagation and test fresh sessions; active listeners may temporarily retain earlier behavior. [Firebase deployment guidance](https://firebase.google.com/docs/rules/manage-deploy).
5. Preserve the actual prior policy copies. For rollback, stop affected trusted routes/local server first: Admin bypasses Rules. Restoring reviewed prior policies is a separate operator decision. Do not open access or delete indexes/data. Rules rollback does not undo writes or revoke existing bearer media URLs.

## Indexes

No indexes changed in this task. The existing **155 composites** in `firestore.indexes.json` plus its `favourites.listingId` field override remain the query catalogue. The override preserves collection ASC/DESC and adds collection-group ASC for trusted favourite counts. Imported content also needs normal single-field date indexes. Profile creation by UID does not need a composite.

Cloud readiness is **unverified**. If required indexes are not already built, an authorized operator may review/run this index-only command; it was not run here:

```powershell
Set-Location E:\ThrottleHub_codex_code
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.json --project throttlehub-9d6b9 --only firestore:indexes
```

Review unexpected deletion prompts. Wait for required indexes READY. With approved read credentials, run `node scripts/backup-firebase-security.mjs` then `node scripts/check-firebase-index-readiness.mjs` to compare exact definitions/field overrides from a fresh completed backup. Otherwise an operator must compare Console status with the catalogue. Emulator success is not cloud index certification.

## Test with npm run dev

1. Configure authorized **server-only** Admin authentication with appropriate Firestore, Storage and Auth revocation-check permissions. A Web API key alone cannot authenticate Admin. No credentials/keys were created or downloaded here. Keep them outside Git and `NEXT_PUBLIC_*`; use an approved development credential/impersonation workflow. [Google's local ADC options](https://cloud.google.com/docs/authentication/set-up-adc-local-dev-environment). This is one-time server authentication, not per-user marketplace approval.
2. Existing `.env.local` is cloud mode: `NEXT_PUBLIC_FIREBASE_MODE=development`, project/confirmation/`GCLOUD_PROJECT` equal `throttlehub-9d6b9`, correct Web settings, and no emulator endpoints. The approval flag has been removed. Confirm Email/Password, Google and authorized `localhost` in Console; their live state was not read here.
3. After reviewing/publishing both policies and verifying indexes, restart:

```powershell
Set-Location E:\ThrottleHub_codex_code
npm run firebase:check
npm run dev
```

The terminal should identify the real project without starting emulators. Open **http://localhost:3000**. Emulators remain separately available via `npm run dev:emulator` and `npm run test:integration`.

4. Sign in to the existing account and complete `/auth?setup=1`, or register normally. Check `profiles/{exact Auth UID}`, correct account type, preserved Business details/creation date after reload/sign-in, and Google onboarding. No approval document is needed. Restart/fresh tabs clear the prior cached approval error.
5. Test two real accounts in separate browser profiles: own draft/photo/running video/publication, province search, messages, favourites, notifications and historical states. Require foreign profile/listing/media mutation and private chat/evidence reads to fail. Use genuine owned content; do not seed fictional inventory or delete retained historical adverts as cleanup.

## Remaining security limitations

The prior public-launch findings remain: distributed platform rate limiting/App Check/cost controls; trusted inspection and quotas for stolen/news/evidence/PDF uploads; legacy media and bearer-token/retention lifecycle gaps; installed monitored orphan cleanup/retries; complete account export/deletion/retention implementation; live IAM/CORS/providers/index and device acceptance. Listing photo/video inspection and quotas are retained; some concurrency limits remain per process. Removing the cohort is not a replacement abuse-control system or proof of unrestricted public-launch safety.

## Changed files

Removed the approval helper, overlay generator/configuration/generated files and two approval-only tests. Updated profile service and the affected listing/photo/video/stats/engagement/notification endpoints to remove only cohort checks; profile error wording is now normal connection/setup language. Removed the local/example flag. Updated existing profile/API/engagement tests; added `tests/normal-registration.test.ts`, `tests/normal-access-config.test.ts`; updated the emulator test exclusion list. Base Rules received comments only. Added this report and supersession notices to older private-mode/account reports. Existing uncommitted work was not reset; no commit/push was made.
