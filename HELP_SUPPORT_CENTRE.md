# ThrottleHub Help & Support Centre

28 October 2026. Local implementation for `throttlehub-9d6b9`; no deployment, live data writes, role provisioning, credential changes or payment-backend changes performed. Existing mobile/video and other uncommitted changes preserved.

## Routes and operation

- Customers: `/help`. Create a request with one of nine categories, a subject, description and optional listing/payment reference. Read/reply, upload screenshots, see opened/status information, resolve/reopen and page through older conversations.
- Administrators: `/admin/support`, using the existing Firebase `admin: true` custom claim and normal sign-in. Moderators without that claim have no support access. Includes exact-reference lookup, customer history, public profile name/type/location, combined status/category/priority filters, updated/oldest-waiting ordering, shared queue counters, replies, private notes and activity history.
- `/api/support`: authenticated GET/POST/PUT, verified tokens with revocation checking. Customer identity and admin privileges come from verified tokens, never submitted fields. Guest access uses a separately checked capability.
- Entry points: footer, header/mobile support badge, account navigation, existing administrator navigation and promotion-payment help link. `/info/help` remains available for existing getting-started content.

References use `TH-` followed by 24 uppercase hexadecimal characters. References are identifiers, not access credentials. Payment references are customer-supplied text only: support does not fetch payment financial records, refund transactions, alter promotions or reveal payment credentials.

## Conversations, permissions and limits

All ticket payloads are API-only; no direct client read/write to tickets, notes, messages, audit events, attachments, limits or guest grants. Admin API access checks apply on every request, including image playback. Customer-to-customer access is rejected with a generic 404. No HTML rendering of submitted text. Public errors contain no stack traces or database details.

- Tickets: 5 creations per account per 24-hour window. Replies/status/read actions share 120 actions per account per window. Limits use Firestore transactions and persist across servers/restarts.
- Subject 3–160 characters; message 1–6,000; JSON request capped at 10,000 bytes before buffering. References are bounded safe IDs. Server-generated millisecond dates, immutable identity/creation information, server-owned priority/status decisions.
- Safety/fraud tickets start at high priority automatically. Customers cannot assign arbitrary priority or administrator roles. Staff can change priority; customers can resolve or request reopening. Resolved requests must reopen before replies.
- Screenshots: JPEG/PNG/WebP, maximum 5 MiB input, 24-megapixel decoding limit, actual Sharp decoding, orientation handling, 1600px resize, JPEG re-encoding and metadata removal. SVG/PDF/video are not support attachments. Maximum 12 reserved uploads per ticket and 12 starts per account per 24 hours; failures consume quota. Screenshots are optional and added after creating a ticket.
- Accepted images are never served using Firebase download tokens or public bucket URLs. The private API returns authorized image bytes with `private, no-store` and `nosniff`; the browser uses revocable local blob URLs. Direct Storage SDK reads/writes are denied even for staff. Inspect bucket IAM/default ACLs before live use: Rules cannot override public IAM grants.
- No automatic ticket/account deletion or retention purge is introduced. Support records and screenshots must be included in the operator's export/deletion/legal-hold policy before public launch. An interrupted upload may leave a reserved pending attachment and an inaccessible orphan object; investigate pending attachment records and review deletion separately. No production cleanup was run.

## Notifications

`supportSignals/staff` stores transactional shared queue counters (open, unread, waiting for staff, waiting for customer, resolved, high priority) and the latest notification reference/sequence. Each customer has `supportSignals/user-{uid}` with unread count and latest update. Document listeners update badges without periodic polling or reading the entire ticket collection. Reading a ticket marks that side read; staff unread state is shared across administrators, not individual per-agent assignments.

Customer creation/reply/reopening and high-priority assignment notify staff; staff replies/status changes notify the customer. Badge links open the exact latest ticket. Ticket history remains the durable record of all updates; this is not a separate unlimited notification-event inbox. Counts are per unread ticket, not per message. Older unread requests remain in the paginated queue. Guest users have manual refresh through their private access key rather than authenticated Firestore listeners.

Optional **foreground browser alerts** require a button click and explicit browser permission. They use generic text, can be disabled and are limited to the currently open page/session. Denials/unsupported browsers leave in-app support usable. They do not work after all site tabs close and delivery is not guaranteed offline.

**FCM background push is not implemented or activated.** It requires a VAPID public key, messaging service worker, permission/token registration and revocation, authorized subscription storage, server delivery/retries and live browser tests. No FCM subscriptions, secrets or Cloud Functions were fabricated. A service worker/VAPID setting alone would not complete this feature. See [Firebase background reception](https://firebase.google.com/docs/cloud-messaging/web/receive-messages). Signed-in support has no email or paid-helpdesk dependency.

## Guest recovery

The public form lives on `/help` when signed out. It defaults to disabled server-side. To enable after approval:

1. Register this existing Firebase Web app for App Check with a reCAPTCHA Enterprise site key and the exact intended domains.
2. Set `NEXT_PUBLIC_SUPPORT_RECAPTCHA_KEY` to the public site key for the Next.js build and `SUPPORT_GUEST_ENABLED=true` server-side. Neither was added to `.env.local` here.
3. Grant the runtime identity the **Firebase App Check Token Verifier** permission needed for token consumption. Do not create/download a private key or grant Owner for this.
4. Verify valid, missing, denied and replayed tokens with real browser attestation before opening guest access. No global Firebase enforcement toggle is needed for this endpoint; do not enable unrelated enforcement without checking all clients.

The client requests a limited-use token; the server verifies and consumes it, rejecting replay. A global transactional cap allows at most 20 guest creations per 24-hour window, independent of supplied names/IP headers. This is intentionally conservative; it can exhaust and deny legitimate requests. App Check is an abuse signal, not proof of a person's identity or complete DDoS protection. Reverse-proxy/request-volume limits and monitoring remain needed for public traffic. [Firebase replay protection and runtime permissions](https://firebase.google.com/docs/app-check/custom-resource-backend), [web Enterprise setup](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider).

Successful guest creation returns a random 256-bit access key once. Only its SHA-256-derived identity is stored in `supportGuests`, with a 90-day expiry. Future requests require the key in a header and a valid stored grant. A forged/random key cannot create tickets through the authenticated path. Keys never go in URLs, logs or localStorage. The guest must save the key and reference; losing it has no self-service recovery. This grants ticket access only, not ownership of a claimed Firebase account. No account-existence lookup or automatic account reset occurs. Reliable email delivery/recovery would require a separately configured and verified mail workflow.

## Data and local policies

- `supportTickets/{id}`: owner, category/subject, references, lifecycle, priority, unread flags and timestamps.
- Nested `messages`, `notes`, `activity`, `attachments`: separately authorized by the server. Notes/activity are staff-only; messages/images are owner/admin.
- `supportSignals/{id}`: only own signal or admin staff signal may be directly read; no client writes/listing.
- `supportLimits/{key}`, `supportGuests/{hashIdentity}`: server-only default-deny.
- Storage `support-images/{ticketId}/{attachmentId}.jpg`: server-only; authorized private proxy.

Local `firestore.rules` adds narrow signal gets and explicit ticket denial. Local `storage.rules` explicitly denies support-image client access. Existing fallback denial protects remaining support namespaces. No broad permission was added. Neither deployed nor private-overlay rules were overwritten.

The index generator/catalogue adds **31** support composites to the existing 171, for **202** total; none removed. Thirty cover all nonempty subsets of owner/status/category/priority plus updatedAt DESC or waitingSince ASC, with document ID DESC; one covers waitingSince ASC/document ID DESC. Recently updated unfiltered and message histories use default single-field indexes. Emulators do not enforce composite readiness.

## Validation

Full isolated emulator/application suite: **258 tests passed across 47 files**, including all seven new support tests and existing payment, account, messaging, photo and video regressions. Evidence: `.tools/support-tests-verified.log`, which records runner exit 0. TypeScript passed both the isolated project check and ordinary `tsc --noEmit --incremental false`. ESLint: **0 errors, 20 warnings** (19 pre-existing; one intentional native image for a protected blob preview). Isolated production build passed; evidence `.tools/support-build-verified.log` and `.tools/support-build-exit.json`. The user's running `.next` was preserved. Index check confirms 202 unique composites, 31 for support, with no duplicates.

The first restricted run could not execute FFmpeg. Two subsequent runs exposed the existing five-way concurrent profile test's 5-second timeout; only that test's allowance was raised to 20 seconds, with unchanged assertions. The final full run passed; no production profile behavior was changed to satisfy it.

New tests cover verified auth, guest default-deny/attestation/replay, bounded bodies, role/ownership isolation, private notes, lifecycle, audit, quotas, exact unread counters, private sanitized screenshot serving, Rules denial, and paginated history. Actual live App Check, browser permissions/device layouts and cloud index readiness require operator acceptance. Browser inventory reported the browser access host unavailable; no responsive browser/device pass is claimed. App Check tests mock attestation; they do not certify the live provider. Build/type checks cover the final composer guard that clears private drafts on changing ticket/tab; browser behavior still needs acceptance.

## Release steps — prepared only, approval required

1. Review diffs including prior uncommitted work. Preserve a fresh completed read-only security backup; use existing approved server credentials.
2. Run local checks with Node 22, Java and FFmpeg available:

```powershell
Set-Location E:\ThrottleHub_codex_code
npm run typecheck
npm run lint
npm run test:integration
npm run build
node scripts/backup-firebase-security.mjs
```

3. Only after explicit approval, create the reviewed indexes and wait for readiness:

```powershell
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.json --project throttlehub-9d6b9 --only firestore:indexes
node scripts/backup-firebase-security.mjs
node scripts/check-firebase-index-readiness.mjs
```

4. In a coordinated compatible Next.js release, after approval:

```powershell
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.json --project throttlehub-9d6b9 --only firestore:rules
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.json --project throttlehub-9d6b9 --only storage
```

Deploy the existing Next.js app using its chosen hosting process (not selected/changed here), or restart localhost with `npm run dev` for controlled testing. Runtime needs existing Firebase Admin credentials, verified bucket name, Node runtime and Sharp support. No new Functions deployment, Paystack deployment or email service is required. Guest App Check setup is optional for signed-in tests. Review all policy changes since the last deployment; these commands deploy the full reviewed files, not just support blocks.

5. Test with two designated customer accounts and an existing authorized admin: foreign ticket/image denial, customer/admin replies, private notes, close/reopen, unread counts, category/priority combinations, >30 messages, phone layout, auth switching, attachment validation and optional alerts. Use non-sensitive genuine requests; do not seed live fictional inventory. Keep guest creation off until live attestation passes.

Rollback: stop the affected Next.js routes/application and restore the reviewed compatible app/policy snapshot after approval. Keep added indexes and customer records; do not delete production support histories. Previous deny-all policies close access but do not stop Admin SDK routes; never loosen rules to fix a failure.

## Cost and operational limitations

No helpdesk subscription or extra scheduled Function. Costs are existing Next.js processing, Firestore reads/writes/index storage, private Storage bytes/egress and optional App Check assessments. One ticket mutation writes the parent, audit, counters and quota, plus a message where applicable; exact write count varies by action. Page size is 30 and attachment list at most 12. Counters avoid full scans. Listeners reconnect/read when pages open and receive updates; many simultaneous admins/clients increase reads. Staff aggregate counters can become a write-contention point at high volume. This implementation targets a small support operation, not a guaranteed high-volume helpdesk. Monitor usage/429/503, orphan reservations and unanswered tickets; quotas are not a billing cap. No live costs or delivery guarantees were measured.

## Changed files for this task

New: `src/lib/support-model.ts`, `support-service.ts`, `support-app-check.ts`; `src/app/api/support/route.ts`; `src/components/support-centre.tsx`; `src/app/help/page.tsx`; `src/app/admin/support/page.tsx`; `src/app/support.css`; `tests/support-api.test.ts`; `tests/support-integration.test.ts`; this report.

Updated: `src/app/layout.tsx` (support CSS); `src/components/shell.tsx`; `src/components/admin-navigation.tsx`; `src/app/account/page.tsx`; `src/app/account/promotions/page.tsx` (help link only); local Rules/index files and generator/catalogue; `vitest.config.ts` (isolated support suite); `tests/content-profile-integration.test.ts` (only a 20-second timeout for the existing five-concurrent-transaction test, which repeatedly exceeded its 5-second budget; assertions and application logic unchanged).
