> Current localhost/private-cloud plan: [FIREBASE_PRIVATE_TEST_READINESS.md](FIREBASE_PRIVATE_TEST_READINESS.md). Latest verification: **169 tests,29 files;155 prepared indexes**. This document preserves its earlier audit snapshot where superseded. No cloud deployment was performed.

> Current integration decision: **NO-GO for public launch**. See [final deployment report](FIREBASE_DEPLOYMENT_GO_NO_GO.md) for the unified configuration, latest 157-test result, fresh verified backup, remaining blockers and exact release/rollback commands. Earlier observations below are historical where superseded.

> Updated after seller-account and running-video implementation: see [SELLER_ACCOUNTS_RUNNING_VIDEO.md](SELLER_ACCOUNTS_RUNNING_VIDEO.md) and [latest test results](audit/seller-video-test-results.md). The report below preserves the initial audit snapshot. Subsequent authorized read-only checks confirmed the real project/database/bucket, completed a cloud policy backup, and found deployed deny-all rules with zero indexes; Auth-provider reads returned HTTP403. The current matrix contains 85 contracts and the index catalogue 160 entries, including private Admin video-maintenance group queries. No cloud deployment or data mutation was performed.

# ThrottleHub Firebase security and functionality audit

Audit date: 23 October 2026. Workspace: `E:\ThrottleHub_codex_code`. Cloud target: **`throttlehub-9d6b9`**. Starting commit: `393f4e782c0a057890a05af0fcba5ff9db11a136`.

## Decision

**The backend is not yet ready for unrestricted secure public launch.** Local authorization has been hardened and the checked-in workflows pass the tests described below. This is not certification of the deployed backend. Cloud credentials were unavailable, deployed policies could not be compared, and several media, abuse-control and privacy workflows remain unfinished.

No cloud deployment, production document write, customer-data deletion, user/claim change, billing/region change, website deployment, Git commit or push was performed. Test records were created only in `demo-throttlehub-tests` on isolated loopback emulators. The existing site and backend architecture were retained.

## Review artifacts

- [Permission matrix: 72 authorization contracts](FIREBASE_PERMISSION_MATRIX.md), including source, operation, actor, allow/deny condition, rule, index and associated test or explicit coverage limitation.
- [CSV matrix](audit/firebase-permission-matrix.csv).
- [Mechanical source-call inventory](audit/firebase-operation-inventory.json): 554 candidate calls in 45 application/script files. Includes nested query calls and explicitly labelled non-Firebase method candidates; this is not 554 distinct Firebase operations or 554 tested permissions.
- Complete final [Firestore Rules](firestore.rules) and [Storage Rules](storage.rules). These files are the implementations to review; they are not asserted to match currently deployed rules.
- [Every composite index, in order](audit/firebase-index-catalogue.md), all included in [firestore.indexes.json](firestore.indexes.json).
- [Read-only cloud policy backup utility](scripts/backup-firebase-security.mjs).

Configuration, rules, client initialization, trusted Admin initialization, authentication, API routes, public server readers, lifecycle/media services, nested collections, query construction, admin bootstrap, emulator setup, existing tests and Firebase documentation were inspected. Older architecture/setup documents contain superseded statements; use this report and actual code for this audit's changes. In particular, direct admin listing status writes are now denied, participation restrictions apply beyond the forum, and the real `.env.local` uses cloud mode despite older local-first setup text.

## Feature assessment

“Local pass” means the named tests exercise the relevant contract, including grouped positive and negative assertions. It does not imply every browser interaction or production configuration has been tested.

| Feature | Authorization and functionality assessment | Remaining qualification |
| --- | --- | --- |
| Email/password accounts | Registration, sign-in, sign-out and password reset pass using real separate emulator Auth identities. Public profile field/ownership checks pass. | Live provider enablement, verification/reset delivery, production persistence and recovery UX need browser testing. |
| Google login | Existing Firebase popup flow waits for persistence initialization; emulated Google identity works. | Real Google popup, authorized domains, provider consent and popup/account-conflict cases are not verified live. |
| Profiles and protected pages | Public fields are allowlisted; private account email is not a public profile field; self-admin and foreign-profile writes denied. | No self-service account deletion/export; operator process is unfinished. Google photo is an external HTTPS URL, not a profile bucket upload. |
| Marketplace | Trusted token-checked transaction handles publish/edit/price/status/removal; owner and immutable fields protected; suspended mutations denied. | API abuse limits and trusted media-byte validation remain launch blockers. |
| Listing history | Sold/expired/on-hold direct access and photos retained; excluded from active inventory; new enquiries blocked; stable URLs preserved. | Removal/restriction cleanup retry needs operational monitoring; existing private chats must remain private and retained according to policy. |
| Categories/compatibility | Static taxonomy; generated validation restricts permitted category/make/model/year/compatibility fields. | Curated model catalogue is not exhaustive; no public category-write collection exists. |
| Search and location | Bounded ZA/ZAR active queries, province/category/term filtering, stable cursors and refinements pass integration tests. Public response uses field projection. | Emulators do not enforce indexes; deploy/build readiness and sparse-query costs need cloud verification. |
| Storage/media | Owned paths, file size/MIME, foreign deletion, approved-photo protections, unknown paths and private SDK reads tested. | MIME is not byte validation. Private token lifecycle, quarantine, orphan cleanup and retention are not complete. |
| Messaging | Two distinct Auth identities; fixed participants and sender; nonparticipants denied; message edits/deletes denied; bounded timestamp forgery. | No comprehensive spam limiter; current numeric clocks have a ±60-second acceptance window; browser concurrency/read-state cases require validation. |
| Favourites/saved searches | Own namespace only; private foreign access denied; saved-search filter contract validated. | Favourites do not require a currently existing listing and their creation timestamp is not strongly validated. This affects personal saved state, not access to another user's data. |
| Follows | Reciprocal atomic relationships, no self-follow, server dates, public graph and foreign-write denials tested. | Account deletion must remove both edge directions. Large browser pagination not fully exercised. |
| Reviews | One per pair; two-way conversation evidence; integer stars; author/subject field diffs; moderation protection tested. | This proves interaction, not a completed transaction. Published raw Firestore documents contain opaque conversation/message IDs; APIs omit them. |
| Notifications | Verified UID scopes private feed; no message body disclosure; read-state API is scoped to caller. | Activity digest is bounded, not a full notification log. Read-state POST has not received a complete HTTP integration test matrix. |
| Forum | Owner identity, locked/hidden parents, edits, soft removal, moderator roles and 15-second creation cooldown tested. Activity bump tied to actual new reply. | Broader abuse controls and timestamp hardening of other public content remain. Reactions/votes/raw video uploads do not exist. |
| News/events | Public published-only reads; admin-only official create/update/delete; drafts protected; news media admin path tested. | Editorial list caps at 30; event media uploads do not exist; deleted articles can leave orphaned images. |
| Stolen bikes | Pending/reviewed ownership boundaries, private evidence/tips, owner recovery, moderation, protected photos and exact private evidence pointers tested. | Archived-photo bearer URL revocation and private evidence file inspection/retention need completion. |
| Jobs/entries/services | Pending submission, owner edit reapproval, public ZA records, moderator approval, known categories and field boundaries tested. | The advertiser contact email is explicitly public. No directory media uploads exist. |
| Administration | Roles come from verified custom claims; no editable profile role source; direct listing bypass closed. Local bootstrap refuses cloud. | Authorized cloud role provisioning, least-privilege service IAM, audit retention and moderator-role revocation need operator verification. |

## Findings corrected locally

| Finding | Change and evidence |
| --- | --- |
| Admin listing rule could hide/republish directly, bypassing lifecycle history/media handling | Removed the direct admin status exception from Firestore Rules. Website moderation already uses the trusted API. Regression denies direct admin write; trusted admin moderation succeeds. Workflow test now uses the service. |
| Listing Admin transaction ignored participation restrictions | Reads caller's `restrictions/{uid}` inside the transaction and denies suspended callers. Direct draft writes/uploads also require active account. Restriction UI wording now describes broader participation. |
| Moderator could act as seller on another person's advert | For a foreign advert, moderator authority is limited to `status=hidden/rejected`. Selling, relisting, removal, save and anonymisation are not moderator powers. Admin remains explicitly privileged. |
| Message/conversation/read timestamps could be arbitrarily forged | New conversations/messages and own read markers require current millisecond values within ±60 seconds. Conversations additionally validate the actual ZA/ZAR listing seller and title; immutable membership stays protected. Legacy stored dates are not rewritten. |
| Listing title could become stale while opening a conversation | Contact transaction rereads the current advert before creating the conversation, uses its title and rejects a changed/unavailable listing. Existing conversations remain independent of current listing status. |
| Public forum activity could be bumped without posting a reply | New `lastReplyId` links an atomic parent update to a previously nonexistent own reply whose creation time matches the bump. Frontend writes that ID in the same batch. Existing threads need no backfill. |
| Reviewed stolen photos could be replaced/deleted by owner | Owner staging/replacement now limited to absent or owned pending/rejected reports; published/recovered/archived media protected from owner replacement/deletion. Moderator removal remains explicit. |
| Draft/evidence image metadata could be arbitrarily rewritten | Owner updates preserve custom metadata and content type. Upload sizes/types remain constrained. Metadata-only mutation attempts are denied in regression tests. This does not establish that supplied MIME matches bytes. |
| Evidence document could point at an unrelated report/user's path or be rewritten after approval | At most four `stolen-evidence/{callerUid}/{thisReportId}/{filename}` paths, with four nonempty path segments, are accepted. Active owner may write metadata only while pending/rejected, using `getAfter` for initial batch submission. |
| Admin-backed marketplace results spread unexpected fields | Shared `publicListing` allowlist now used by detail, homepage listing feed, marketplace API and initial seller listings. Internal text tokens remain available while filtering and are removed from returned projection. A regression verifies unexpected email/buyer/moderation fields are omitted. |
| Public review cursor accepted hidden documents | Cursor must exist and be published before being used. Other public detail helper IDs now reject malformed IDs before querying. |
| API bodies were size-checked after complete buffering | Shared streamed-byte reader caps listing, search and notification bodies, including chunked/no-content-length inputs. Reader cancels on overflow; tests include multi-byte Unicode. |
| Search backend failure was reported as invalid user input | Malformed JSON/body shape/Zod errors return 400, oversized bodies 413, missing indexes/backend outages 503, successful search no-store. New API tests cover these distinctions. |
| Profile/photo/message errors could disappear | Google photo-sync failure is visible without claiming photo success; account profile read and message preview/name failures now show an error. Successful Auth is not described as a failed identity creation. |
| Combined stolen-bike filters lacked index combinations | Generator adds the 26 previously missing combinations of two through five equality filters. All 32 subsets of make/model/year/region/city are covered; schema test checks every subset. |

## Security boundaries and limitations

Firestore and Storage remain default-deny. Public listing reads require an allowed public status and ZA/ZAR. Private nested messages, evidence, cleanup jobs and price history do not inherit public parent access. No broad recursive client write allowance or collection-group query permission was added. Actual application queries use ordinary collections/subcollections, not collection-group queries.

Firestore Rules are not result filters. Client public queries constrain status/country where required; owner and participant queries constrain the relevant UID. Privileged Next.js readers must independently apply those predicates because [server/Admin clients bypass Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started). Listing and notification endpoints verify Firebase ID tokens with revocation checking and derive UID/roles from the token, not request body fields. Listing mutations enforce owner/status/schema/date checks in the transaction. Credentials remain server-only and are not copied into the browser.

Public profile documents intentionally contain public location/bio/photo. Public review documents contain interaction reference IDs; knowing an ID is not permission to read the referenced private conversation. If those IDs must themselves be confidential, separate private review evidence documents are needed. That document split was not performed during this audit.

Storage rules check allowed MIME and maximum bytes, as supported by the [Storage Rules conditions API](https://firebase.google.com/docs/storage/security/rules-conditions). They cannot prove that uploaded bytes decode safely. The frontend resizes/compresses images, but a direct SDK caller can bypass the browser preprocessing. Some regression objects deliberately contain minimal arbitrary bytes with an allowed MIME: they prove access/metadata controls, not safe image decoding. There is no server-side media scan or content sanitization guarantee.

`getDownloadURL` produces a URL suitable for direct downloads; see [Firebase download guidance](https://firebase.google.com/docs/storage/web/download-files). Treat token URLs as bearer capabilities: changing a Firestore status is not, by itself, a revocation of an existing URL. Listing restriction/removal has tested trusted copy/delete handling. Stolen-report archive/news unpublish and private-evidence retention do not have an equivalent complete token-revocation lifecycle. The evidence UI stores paths and uses authorized SDK `getBlob`, which avoids publishing URLs but does not certify that no object has a download token.

Suspension is a Firestore participation restriction, not deletion/disabling of an Auth identity. Restricted members may still sign in, read allowed content, manage their public profile and remove personal saved/follow data. They cannot use the now-guarded listing service, upload paths, new messages/conversations, forum posting, review creation or directory submissions. Trusted staff actions elsewhere still use claim checks; this is not a universal Auth ban.

## Tests and verification

Final results are recorded in `audit/firebase-test-results.md`. Reproducible commands:

```powershell
npm run typecheck
npm run lint
npm run test:integration
npm run build
npm run firebase:check
npm run firebase:verify-cloud
```

This workstation does not expose Node globally to the tool shell. Tests were run with `.\.tools\node-v22.23.4-win-x64\node.exe scripts/test-emulators.mjs`; the runner supplies the local Node/Java paths to children. TypeScript and ESLint were invoked through their installed local JS CLIs. The production build used an isolated `.tools/community-build-*` copy and shared node_modules, avoiding interference with the user's running `.next` development directory.

The full suite includes independent temporary Auth users, email reset-code round trip, an emulated Google identity, real SDK uploads/downloads, client Rules enforcement and trusted Admin lifecycle calls. The HTTP listing tests mock the service boundary and test token authorization/partial cleanup failures. Search HTTP tests mock the query provider while real Firestore query behavior is covered separately.

Expected negative permission tests emit `PERMISSION_DENIED` and evaluation-error traces; a denied operation under `assertFails` is a passing security assertion. Those expected logs are not concealed. Emulator shutdown SIGINT messages are normal cleanup. Some Admin test libraries probe the metadata server before using the emulator; no credential was obtained and cloud endpoints were not used for test data.

Coverage is **not exhaustive**: no connected browser was available for a full visual/multi-tab workflow audit; real Google/email delivery/persistence are unverified; live indexes, bucket CORS/IAM/App Check, every direct moderator transition, notification read-state HTTP permutations, every file path/type/size permutation and all race/retry cases were not exercised. A passing suite must not be described as proof of zero possible production permission errors. The [Firestore emulator does not track compound indexes](https://firebase.google.com/docs/emulator-suite/connect_firestore), so the explicit index-catalogue check is necessary but still not a live index test.

## Remaining launch blockers

1. **Real cloud verification and policy comparison.** No authorized ADC is configured here. The read-only cloud verifier and backup utility both failed closed before obtaining credentials. Actual deployed rules, provider enablement, project/database/bucket ownership/location, IAM, authorized domains, CORS, App Check and index READY status are unverified. Existing cloud data has not been checked for legacy schema/private-field violations. A correct local project ID is not proof of these facts.
2. **Abuse/cost controls.** Public Admin-backed search/review pages and authenticated listing/notification/message/report/upload flows lack comprehensive distributed limits, upload quotas and operational alerts. Forum creation has a real 15-second rules cooldown, but that is not a whole-platform rate limiter. There is no App Check SDK/backend integration in the current application. Choose and implement appropriate controls before broad launch; do not simply toggle console enforcement and break existing clients. [App Check custom backends require explicit token verification](https://firebase.google.com/docs/app-check/custom-resource-backend); App Check does not replace ownership checks or rate limits.
3. **Media inspection and lifecycle.** Add trusted byte/signature/decode validation and safe serving of user files, including PDFs. Listing image URL ownership is validated, but publication does not verify that every referenced object actually exists and decodes. Decide private-evidence bearer-token policy and revocation/retention. Complete archived/unpublished public-media revocation, orphan cleanup, cleanup retry monitoring and retention for restricted copies. No automatic production deletion job was introduced.
4. **Account privacy operations.** Establish secure account deletion/export, recent-auth checks, retention/legal hold policy and operator workflow. Account deletion needs a coordinated treatment of retained advertisements, chats, reviews, evidence, favourites and both follow directions. Directly deleting a public profile is deliberately not an acceptable substitute.
5. **Controlled live acceptance and release sequencing.** Obtain a current cloud policy backup, confirm schema compatibility and all required indexes READY, then run an explicitly authorized smoke test with designated accounts and genuine operator-supplied content. Real Google, private file CORS, device clock behavior and deployed route authorization must pass before launch. No demo inventory should be seeded.

Additional known hardening/maintenance work: numeric timestamps on some forum/report/moderation/event fields are not uniformly trusted server timestamps; audit-action strings are not all enum-validated or cryptographically coupled to each moderated change; some admin lists/inbox/favourites are capped; some expected unavailable-favourite lookups collapse different errors into an unavailable state. These are not claims of foreign-data access, but they prevent an exhaustive “every operation is production-ready” assertion. Restriction writes do not validate the target user's custom claims, so a trusted moderator can restrict another staff identity; operational role policy should be explicit. The review cursor fix is code-reviewed but has not received a dedicated HTTP regression test.

## Cloud configuration and deployment plan

The local-only config check passed: Web settings are complete, cloud ID/confirmation/GCLOUD_PROJECT equal `throttlehub-9d6b9`, Auth domain is `throttlehub-9d6b9.firebaseapp.com`, bucket is `throttlehub-9d6b9.firebasestorage.app`. Actual credentials were neither invented nor overwritten. `.env.local`, `.env.emulator.local`, `.secrets`, local tools and service-account files remain ignored and untracked. Do not put an Admin private key or service-account JSON in any `NEXT_PUBLIC_*` variable.

Required Auth providers: **Email/Password** and **Google**. Verify provider support email/consent and the final hosted authorized domain plus the localhost name actually used for development. The emulator account picker simulates Google; it does not log into a real Google account.

`firebase.json` maps `firestore.rules`, `firestore.indexes.json` and `storage.rules`; it contains no alternate storage deploy target. The cloud alias points to the named project, but the default alias remains the safe `demo-throttlehub`. Always pass the explicit project. The default project's default bucket association must be verified before Storage deployment; a local expected bucket name alone is insufficient. Storage rules use Firestore checks, whose required service permissions must also be verified in the actual project.

Before asking for deployment approval, with authorized existing credentials, run these **read-only/local** commands and inspect the exported active releases:

```powershell
Set-Location E:\ThrottleHub_codex_code
npm run firebase:check
npm run firebase:verify-cloud
node scripts/backup-firebase-security.mjs
```

The new backup utility uses only GET requests for active Rules releases/rulesets, composite indexes and the exact bucket's metadata. It verifies project/bucket configuration and bucket project number, never prints an access token, reads no customer documents/users/object bytes, and writes only ignored local backups. It has been syntax/lint checked and its no-ADC failure path exercised; its successful authenticated cloud-export path remains untested. A directory without `COMPLETE.json` is not a usable completed backup. Store a verified completed backup safely outside ephemeral `.tools` before deployment; no backup exists from this session. Compare `releases.json` and corresponding source files against the local files, including the Storage release for the expected bucket. Preserve active release/ruleset IDs and current index state. Existing unmanaged indexes must be reviewed rather than accepting an automatic deletion prompt.

The 159 checked-in composite indexes include 26 additions; no existing checked-in index was removed. The full enumerated list is in `audit/firebase-index-catalogue.md`. Default single-field indexes are also required. `fieldOverrides` remains empty. The code uses no collection-group query. Index creation completion is not implied by a successful rules deploy.

**Deployment commands below are prepared only. They have not been executed and require your approval after the blockers and comparison are resolved.** The local Firebase CLI is used directly to avoid global-version ambiguity:

```powershell
# Phase 1: create/confirm indexes, then wait for every required index to be READY.
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.json --project throttlehub-9d6b9 --only firestore:indexes

# Phase 2: coordinated release of the reviewed application and policies.
# Do not execute these while an old frontend still sends the old forum bump payload.
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.json --project throttlehub-9d6b9 --only firestore:rules
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.json --project throttlehub-9d6b9 --only storage
```

If using the project-local bundled Node in a terminal without Node on PATH, replace the leading `node` with `.\.tools\node-v22.23.4-win-x64\node.exe`. No command above includes Hosting or Functions. Website deployment itself remains outside this authorization.

Release compatibility must be coordinated: the updated frontend sends `lastReplyId` atomically, the updated listing API enforces restrictions/moderator limits and handles cleanup, and Storage protects approved report photos. Old cached frontend tabs may fail a reply bump under the new Rules; require reload or a maintenance window. Do not deploy only the rules to an old application. Existing threads do not need invented `lastReplyId` backfill. Existing public profiles keep the optional photo/province contract; historical listing IDs/URLs/dates are not migrated or reset. Existing malformed legacy records must be reviewed, never broadly opened or silently rewritten.

Rules can take time to propagate and listeners can retain old behavior temporarily. After deployment, use fresh sessions, test permitted/denied operations, inspect logs and confirm index build status. Do not promise instantaneous cutover.

## Rollback plan

1. Before release, preserve the **actual active cloud** release IDs and source using the completed read-only backup; the Git baseline is not evidence of deployed policies. Preserve the compatible application version and release/config metadata. Do not put backups or credentials in a public repository.
2. For a compatibility incident, stop affected new writes using an operational maintenance control while assessing it. Do not temporarily make collections/bucket public. Refresh stale clients and identify the exact rejected query/payload.
3. If reverting policies is appropriate, create a reviewed `firebase.rollback.json` that references the exported prior Firestore/Storage source files. Validate that snapshot against the restored compatible application and verify it does not reintroduce an unacceptable security flaw. A security regression should be rolled forward or remain closed rather than blindly reopening old permissions.
4. Only after explicit rollback approval, use the same project-scoped CLI with that rollback config:

```powershell
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.rollback.json --project throttlehub-9d6b9 --only "firestore:rules,storage"
```

`firebase.rollback.json` is intentionally not fabricated now: no authenticated cloud backup was available. Prepare it from verified actual active source files before deploying. Keep added indexes during application rollback; do not delete indexes or production data as an emergency response. Review any index changes separately. Data written with the new optional fields remains backward readable; no destructive migration is proposed.

## Safe live acceptance after approval

Use two designated accounts and a trusted admin. Confirm the project badge/config before any write. No production test data has been created by this audit. Real testing writes require explicitly designated real content/accounts; do not seed fictional inventory.

Verify Email/Password registration/login/reset/logout, Google popup, reload persistence and account switching; profile privacy and avatar; an owned genuine draft and image upload; publish/search province/category; price change; hold/expire/relist/sold and original URL; unavailable enquiry disabled; participant conversation privacy; favourite/save/unfollow; two-way interaction review and moderation; forum reply/cooldown/lock; pending stolen report/private evidence/moderator approval; directory approval; admin news/event drafts/publication; private bell state. Attempt foreign reads/writes with the second identity and an unauthenticated session and require denial. Confirm that public reads never include private evidence/email/chats.

Do not use a security-test cleanup script against the cloud. Any removal of acceptance content, account closure or evidence deletion must follow the approved operator/retention process. Keep genuine sold/expired/on-hold records for the intended historical behavior. Record unexpected errors and stop the rollout rather than weakening Rules.

## Changed-file review and Git safety

Git status was clean before edits. Git ownership required a command-scoped `safe.directory` exception; no global Git configuration was changed. No unrelated uncommitted work was reset. The incremental TypeScript cache was regenerated by typechecking and restored from the starting committed bytes before handoff; it is not part of the proposed source change.

Changes are confined to:

- `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `scripts/indexes.mjs`: authorization and query catalogue changes above.
- `src/lib/listing-lifecycle.ts`, `src/lib/community.ts`, `src/lib/server.ts`, `src/lib/marketplace-search.ts`: trusted mutation checks, atomic reply payload and public read projection.
- New `src/lib/public-listing.ts`, `src/lib/request-body.ts`: public-field allowlist and bounded HTTP reader.
- Existing listing/search/notification/review API routes: bounded requests, correct failure statuses and public review cursor guard.
- Account/auth/messages/seller pages and detail/community moderation components: compatible payloads, explicit errors and accurate restriction wording.
- Existing `tests/workflows.test.ts`, `vitest.config.ts`, plus new audit/request-body/public-projection/index/search-API tests.
- `scripts/backup-firebase-security.mjs`: read-only deployment preparation utility.
- This report, permission matrix and `audit/` artifacts: evidence and review material, with no credentials or customer content.

Review `git diff` and the new artifacts before committing. No push, deployment or role provisioning is implied by completing these local changes.
