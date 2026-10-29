# Final profile and support compatibility check

28 October 2026. Target: throttlehub-9d6b9.

**GO for local application/rules compatibility. NO-GO for unattended deployment or public launch until live checks below pass.** Nothing deployed; no live documents, credentials, claims or indexes changed.

## Compatibility correction

Legacy profiles with nonempty contacts but no consent flags correctly fail public raw-document reads under safePublicContact(). That also blocked message names and follower cards. Added GET /api/profiles/[id], returning only the public projection, and switched message names, member connections and listing phone availability to it. The route validates IDs, uses no-store, returns null for missing profiles and hides backend errors. Business projection now also allowlists nested business fields rather than spreading unknown legacy fields.

Names, bios, general location, avatars and business descriptions remain public without new consent flags. Phone/email contacts do not. Existing profiles with empty contacts remain directly readable under the rules. Profiles containing unconsented contacts remain owner/admin-readable but foreign/anonymous raw reads are denied. Firestore cannot redact individual fields; do not loosen this condition.

Account settings have separate explicit checkboxes for seller-phone and business-phone/email publication, defaulting false. Signup never assumes consent. Authenticated owner APIs restore private contacts to the edit form; opt-in publishes them, withdrawal removes them from the public projection while retaining private owner access. Creation/editing coverage for personal and business accounts passed in the full suite. No real-browser acceptance is claimed.

## Every profiles read family

| Reader | Compatibility/security |
| --- | --- |
| Listing detail, messages, member connections | Now use sanitized public API, including legacy profiles. |
| Listing form, community thread/reply author, review author | Direct reads use current authenticated user.uid; owner exception permits legacy documents. |
| Seller page | Admin query with explicit projection and publicProfile sanitization. |
| Seller connections heading | Admin direct read; renders displayName only. |
| Profile setup/edit API and service | Verified token UID; private owner response, no-store; private contacts never client-readable. |
| Listing lifecycle | Trusted internal seller-account checks; no raw profile returned. |
| Listing engagement | Trusted phone selection requires explicit consent via publicPhone. |
| Support ticket customer lookup | Admin-only lookup; returns name/account type/region/city only. |
| Reviews API and notification feed | Read profiles/{uid}/reviews, not parent profiles; published/owner-scoped query predicates retained. |
| Follow controls, connection edges, follow mutations | Dedicated followers/following subcollection rules; public graph unchanged, reciprocal writes enforced. |
| Review reads/writes and community moderation | Dedicated review rules; owner/moderator restrictions unchanged. |

There is no remaining client collection-wide profiles query. Parent-profile contact restrictions do not implicitly apply to nested collections with their own explicit rules.

## Migration

No bulk migration is required to keep intended public identity/storefront information displaying with this compatible app. Existing private contacts remain available to their owner; their next explicit profile save atomically separates them into profileContacts and removes unconsented public fields. Mere reads do not migrate anything. No live documents were changed.

A separately approved cleanup migration is still advisable to remove legacy contacts physically from profiles. First inventory and securely back up affected records; preserve createdAt/identity and existing private values, detect concurrent edits, and do not infer consent. The previous release report's mandatory display-migration blocker is superseded by this public API correction. Legacy unknown fields still need inventory before public launch: safePublicContact checks contact fields, not every possible historical field. New writes are schema-restricted; the public API excludes unknown fields.

## Verification

- Full isolated Firebase Emulator Suite/application integration: **265 passed, 0 failed, 50 files**, exit 0.
- Both current complete Firestore and Storage sources compiled and enforced by emulators.
- Support notification listeners, foreign/anonymous/moderator denials, trusted admin access, private attachments, API authentication and quotas passed.
- Legacy privacy/opt-in/withdrawal/private collection tests passed; new public API tests cover legacy personal/business projections, unknown private fields, invalid IDs, absent profiles and sanitized outages.
- TypeScript passed (noEmit, incremental false).
- ESLint passed: 0 errors, 20 existing warnings.
- Isolated production build passed, exit 0; running development .next preserved.
- 202 local indexes, all unique. **No new index needed or added**: public profile endpoint is a document lookup. Existing support ownerId + updatedAt DESC + __name__ DESC index remains present.

Evidence: .tools/release-security-tests.log, .tools/release-security-tests-exit.json, .tools/compatibility-eslint.log, .tools/release-security-build.log and exit JSON. Negative PERMISSION_DENIED traces are expected passing assertions. Emulator success does not prove cloud indexes READY or live IAM correct.

## Support 503: exact remaining limitation

The original customer list query with empty sort passes locally, including an empty database. Missing support counters are not its cause. Server diagnostics now distinguish index-required/building, Admin credentials, IAM permission and other backend failures without logging customer payloads or secrets. Revoked sessions return 401; unavailable credentials remain 503.

**The actual live 503 root cause and recovery are NOT confirmed.** Previous read-only backup failed for unavailable authorized ADC. Use the exact running server environment to inspect its safe [Support] diagnostic, verify authorized ADC/runtime IAM and current support index readiness, then repeat the actual authenticated request. Do not claim the live issue fixed merely because emulator tests pass. No additional live credential or policy verification was performed in this compatibility pass.

## Release instructions — approval required, not executed

Use the normal firebase.json, not the obsolete private-test overlay. Before mutation, obtain authorized existing ADC, complete and preserve a fresh cloud backup, compare deployed policies, verify the runtime and resolve the live Support diagnostic. Do not create/download service-account keys as a shortcut.

```powershell
Set-Location E:\ThrottleHub_codex_code
node scripts/check-firebase-config.mjs
node scripts/backup-firebase-security.mjs
# STOP if backup fails; preserve completed snapshot securely and review actual policies.
# After explicit deployment approval, create only missing prepared indexes:
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.json --project throttlehub-9d6b9 --only firestore:indexes
node scripts/backup-firebase-security.mjs
node scripts/check-firebase-index-readiness.mjs
# Wait for checker exit 0. Review unexpected deletion prompts; never accept blindly.
# In a coordinated maintenance window, with the compatible app ready:
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.json --project throttlehub-9d6b9 --only firestore:rules
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.json --project throttlehub-9d6b9 --only storage
# For localhost, restart the compatible application:
npm run dev
```

Use .\.tools\node-v22.23.4-win-x64\node.exe instead of node if Node is absent from PATH. Hosted app release requires its separately approved hosting process; no Hosting, Functions or Paystack deployment is included. Keep traffic stopped across policy/app cutover. Verify fresh owner/foreign/anonymous sessions, legacy identity display, contact opt-in/withdrawal, support signals and attachment access before reopening. New public API needs working server Admin credentials, just like existing seller pages.

Rollback requires explicit approval and a reviewed fresh snapshot plus compatible application. Keep indexes/data; stop trusted routes if necessary. Never restore private contact fields to public documents or relax rules to make old clients work. Existing historical deny-all backups are not proof of current deployed policy and would close client access, not restore a working website. Public launch remains blocked by prior media inspection/retention, cleanup monitoring, abuse controls and live acceptance findings where unresolved.
