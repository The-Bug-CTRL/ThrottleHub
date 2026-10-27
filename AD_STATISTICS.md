# Advert statistics

Favourites and messaging existed before this change; seller-facing advert statistics did not. My listings now has an **Ad stats** button per retained advert. Stats load on demand and have Refresh/Retry controls.

- Views: an advert page visible for1.5 seconds, counted once per signed-in account or anonymous browser each Johannesburg calendar day. Seller activity while signed in is excluded. Historical public advert views remain eligible.
- Phone reveals: clicking Show phone number when an explicitly public number is available. This measures interest, not completed calls. Historical adverts do not accept new contact events.
- Message clicks: clicking Message seller, including a public visitor being directed to sign in. This does not prove a message was sent. Analytics failure does not block the messaging workflow.
- Favourites: actual current documents saved by accounts, not cumulative heart-button clicks. Unsaving reduces the count. Viewer IDs, conversations and phone numbers are never returned in a stats response.

Add an optional number under Account ? Profile & settings ? Public phone number. Business contact numbers can also be used. This is opt-in public profile data; Auth/private account phone fields are not consulted. Clear the public number to remove the listing phone option. Formatting is validated; accepted numbers have7–15 digits and an optional leading+.

## Protection and limits

GET `/api/listings/{id}/stats` requires a verified non-revoked token, private tester membership when enabled, and exact ownership of the advert. POST `/api/listings/{id}/engagement` accepts only a known event, applies the current public/status guard and server-derived identity, and rejects supplied totals/UID fields. Cross-origin browser submissions are denied. Stats and deduplication records are default-deny to all ordinary Firestore clients; seller reads go through the owner-checked API.

Counters live in private `listingStats/{id}` with pseudonymous SHA-256 keys in `engagementVisitors`. No raw IP, user-agent fingerprint, names, phone numbers or raw UID are stored in these records. Anonymous public visitors receive a first-party HTTP-only SameSite cookie with30-day expiry. Private mode requires Auth, so anonymous events are rejected there. Login/browser changes or cookie clearing can count one person more than once; these are approximate engagement metrics, not verified unique people or fraud-proof advertising reports.

Transactions prevent concurrent duplicate increments; the same event counts once per identity/day. A coarse10,000-new-events-per-listing/day ceiling limits counter writes while allowing phone disclosure to continue. It does not cap reads or whole-platform costs, prevent bot/Sybil activity, or replace distributed abuse controls/App Check. Aggregate counters remain on the stable advert ID through ordinary sale/expiry/relisting. No past views or contact events were invented/backfilled.

Before public launch, define consent/privacy handling for anonymous analytics, retention/cleanup of pseudonymous deduplication records, and coordinated account deletion/export. Cookie expiry does not delete Firestore records. Existing public-launch abuse/privacy blockers still apply. No retention schedule or automatic production deletion was introduced.

## Deployment preparation only

The optional public `contactPhone` profile field was added to the strict Firestore allowlist; generated private rules were refreshed from the same base. Existing Business phone fields remain public by their original contract. The155 composite index definitions are unchanged. A **new single-field collection-group ASC index on favourites.listingId** is prepared in `fieldOverrides`, preserving ordinary collection ASC/DESC indexes. It supports the trusted aggregate favourite count; it does not permit client collection-group reads.

The read-only backup utility now also exports the locally declared field-index configurations; the readiness checker fails closed for missing/unverified field indexes, including snapshots made before this change. This metadata-export extension has been syntax/lint checked; its authenticated cloud success path has not been rerun during this feature task. Existing completed backups remain untouched. The emulator does not enforce this index; verify it READY before live stats acceptance.

Use the existing explicitly approved private activation procedure, not automatic deployment. Index changes use `--only firestore:indexes`; updated profile permissions use the generated private Firestore policy. **No cloud rules/index deployment, production records, account/claim changes or demo inventory were created by this task.** Until the approved policies/index are enabled, live profile saves/stat requests can remain unavailable. The new API/UI ships with the existing Next.js application, not a new backend service.

Validation: full isolated security/integration suite181 tests passed across32 files; relevant API tests deny forged totals, revoked tokens, foreign owner access, private anonymous access and cross-origin/oversized submissions. Service tests cover concurrent deduplication, owner exclusions, historical contacts/views, phone availability, daily ceiling and real favourite unsaves. Logs: `.tools/ad-stats-tests.log`. Browser/live acceptance is still required. Additional final checks are recorded in the task handoff.
