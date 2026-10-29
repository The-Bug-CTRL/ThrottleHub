# Administrator account access repair

29 October 2026. Project throttlehub-9d6b9.

## Confirmed root cause

Read-only Firebase Auth lookup of the UID explicitly supplied by the owner, eYoPUOAcGnQJG19e6megMXwDzX33, succeeded using existing authorized ADC outside the restricted tool sandbox. The account is enabled, provider google.com, and has **no custom claims**: admin=false, moderator=false. This is the confirmed reason it does not qualify for Administrator Tools or support administration. Google sign-in does not automatically confer administrator status. No account or claims were modified, and no tokens/credentials/private keys were printed.

The initial sandbox lookup failed; the authorized read-only retry succeeded. This supersedes earlier tool-session credential-unavailable findings for this lookup. It does not establish every localhost process's credential environment or certify a particular browser's current token. The user-supplied UID was checked; compare it with My Account's displayed UID before provisioning.

## Separate UI/state defects fixed

- Admin support previously always rendered Sign in on an authorization failure. It now distinguishes signed-out from signed-in but unauthorized, and shows claim-check failures explicitly.
- useRole previously checked only when the Auth User object changed. It now subscribes to Firebase onIdTokenChanged, reads strict boolean claims, forces one refresh on identity change, reacts to later refreshes without a refresh loop, unsubscribes and rejects stale asynchronous results. Its returned permissions are tied to the current UID, and initial session loading remains a checking state.
- Main admin dashboard now uses the same role hook, shows checking/signed-out/unauthorized states separately and loads reports only when admin is verified. Server/Rules authorization remains authoritative.
- My Account now provides Account identity & access with the current Firebase UID and an explicit Refresh account permissions button. Existing Administrator Dashboard, Manage Support Tickets and Support Notification Settings remain admin-claim gated; customers and moderator-only accounts are not elevated.
- No Paystack implementation, Firebase Rules, indexes, Functions or live customer records changed. Existing backend verifyIdToken revocation and admin-claim checks remain unchanged.

## One-time operation for the owner to review and run

New scripts/provision-admin.mjs is manual and read-only by default; it is not referenced by startup/deployment. It requires the exact cloud project confirmations, validates UID, reads the actual Auth user, rejects disabled accounts and shows UID/provider/current claim names. --apply additionally requires an interactive terminal and exact typed confirmation. It rereads claims before mutation, refuses intervening changes, merges only admin:true, preserves existing claims and verifies the result. Auth custom-claim replacement has no transactional compare-and-set; do not run another claim-writing tool concurrently. No public elevation API exists.

Run in the terminal with existing authorized ADC and appropriate Auth permissions. No new credentials should be created automatically.

```powershell
Set-Location E:\ThrottleHub_codex_code
# Read-only review (already performed successfully during this task):
node scripts/provision-admin.mjs --uid eYoPUOAcGnQJG19e6megMXwDzX33
# Only after checking that UID matches your signed-in account:
node scripts/provision-admin.mjs --uid eYoPUOAcGnQJG19e6megMXwDzX33 --apply
```

The interactive confirmation must be exactly:

```text
GRANT throttlehub-9d6b9 eYoPUOAcGnQJG19e6megMXwDzX33
```

If node is unavailable on PATH, substitute .\.tools\node-v22.23.4-win-x64\node.exe. The --apply path has NOT been executed; no privileges were granted by this task. A failed write/verification requires a read-only check before retrying.

## Refresh and acceptance

1. Restart the local app to load these code changes.
2. Open /account -> Account identity & access; confirm the displayed UID matches the one above.
3. After the manual command verifies admin:true, click Refresh account permissions. Alternatively sign out, then sign back in with the same Google account.
4. Administrator Tools should appear; choose Manage Support Tickets -> /admin/support. The shared supportSignals listener switches to the staff signal after the claim refresh.
5. Verify the queue and existing notifications. An empty queue is valid; do not create fictional tickets. Any 503 remains a separate server/IAM/query issue; missing claims correctly produce authorization denial, not an excuse to relax checks.

No deployment is required to assign an Auth custom claim or refresh a localhost session. Live post-provisioning browser acceptance remains pending because the owner must perform the explicit manual operation.

## Verification

Full isolated emulator/application suite: **268 tests passed across 52 files, zero failures, exit 0**. Includes Auth/email/emulated Google flows, owner/customer/admin support isolation and attachments, no client role escalation, existing payment authorization, admin navigation rendering and new refreshed-token role behavior (strict claims, identity changes, errors and unsubscribe). TypeScript passed; ESLint 0 errors / 20 existing warnings; isolated production build passed. New operator script syntax and its actual live read-only path passed; its mutating path was intentionally not run. Real Google popup and post-provisioning browser UI were not exercised. Logs: .tools/release-security-tests.log, .tools/release-security-build.log, .tools/admin-access-lint.log.
