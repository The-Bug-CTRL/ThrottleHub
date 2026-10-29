# Read-only deployment preflight — 28 October 2026

**NO-GO pending authenticated runtime evidence. Policies and compatible application pass local validation, but the live Support 503 cannot yet be certified fixed.** No deployment, IAM change, credential provisioning or live document mutation occurred.

## Actual policy comparison

Reviewed completed backup .tools/cloud-security-backup/2026-10-28T21-00-46.904Z, exported 21:00:50.722Z, project throttlehub-9d6b9, exact expected bucket, two releases and 202 indexes. Preserved a byte-verified copy at .secrets/security-backups/2026-10-28T21-00-46.904Z. This supersedes the old deny-all snapshot as evidence of deployed policy at backup time.

**Deployed policies are the private-tester overlay**, not the current normal-operation policies. Local deployment removes privateTester() membership conditions across Firestore and Storage. This intentionally expands access to ordinary authenticated members and anonymous public reads; it must be understood as marketplace activation, not merely a contact-privacy patch. Earlier instruction requested removal of tester restrictions; no activation was performed here.

After mechanically normalizing only the privateTester wrappers and helper, differences are:
- Firestore profile schema adds contactPhone/updatedAt and typed explicit consent fields, safePublicContact validation and public-read restriction. Owner/admin access retained.
- Own-user and admin-only staff supportSignals get permissions added; collection listing and client writes denied.
- Explicit API-only supportTickets/profileContacts denies added; these were already under default deny in the deployed snapshot.
- Storage explicitly denies support-images; previous default deny already denied it.
- Comments only otherwise. Existing ownership, custom-claim checks, lifecycle constraints and media validation permissions are unchanged beyond removal of the cohort gate. No unexpected additional permission weakening found.

Raw comparison evidence: .tools/preflight-firestore.diff and .tools/preflight-storage.diff. Normalized copies used only for comparison, not deployment.

## Support diagnosis evidence and limits

The exact localhost read-only GET to 127.0.0.1:3000/api/support?&sort= returned ECONNREFUSED, including outside the restricted tool sandbox. There is no reachable Next.js listener at that address from this session. Available saved logs do not contain the user's actual failing authenticated request.

Source confirms adminDb initializes the default Firebase Admin application with explicit projectId and applicationDefault() in cloud mode. npm run dev inherits the launching terminal environment merged with .env.local. It does not use Firebase CLI login or the Web SDK API key as Admin credentials. An existing default Admin app is reused after verifying its project ID.

This tool's merged configuration is development/throttlehub-9d6b9, has no GOOGLE_APPLICATION_CREDENTIALS path, and has no readable APPDATA/gcloud/application_default_credentials.json. No credential contents or tokens were printed. The successful user-run backup demonstrates credentials were available to that command, not necessarily to this tool or another already-running Next process. **The actual localhost process credential source is unconfirmed.** Do not assume missing credentials here prove the earlier 503's cause.

Request path: adminDb initialization -> verifyIdToken(token,true), which also requires Auth user-read access for revocation checking -> owner-scoped supportTickets query. A Firestore metadata/index backup does not establish Auth user-read or Firestore document-read IAM. Rules deployment cannot fix Admin IAM: Admin requests bypass Security Rules.

The customer query is ownerId equality, updatedAt DESC, document ID DESC, limit 30. Empty sort is accepted. It reads no initialization/counter documents. The existing 202-index catalogue includes it; the user's fresh readiness report confirms all 202 and required field indexes READY, none unmanaged. Missing indexes are therefore no longer a current reported blocker. A snapshot does not diagnose an older request's failure.

No malformed-query or missing-initialization-data defect is established. Existing diagnostics safely report stage/code/kind and distinguish credentials, IAM, indexes and other backend failures. Local tests confirm empty queue success and correct authentication/error handling. **Exact live failing operation still requires the [Support] diagnostic from the running authenticated request.** Requested only that redacted diagnostic, never bearer tokens or customer payloads. Start the app in the terminal with the intended existing credentials, refresh Support while signed in and supply stage/code/kind. If verification fails before the query, inspect Auth access; if the query fails, inspect Firestore access. Do not weaken revocation checks or rules.

## Compatibility and tests

Contact-privacy frontend/server/rules are ready together: explicit default-off opt-ins, owner-only private-contact API, sanitized legacy public-profile endpoint and compatible message/follower/detail readers. No bulk display migration required; owner saves separate contacts. Existing unknown legacy fields still warrant pre-public-launch inventory.

No application code changed in this preflight; therefore no additional test rerun was needed. Most recent unchanged-source verification: 265 tests / 50 files passed, both rules compiled in emulator, TypeScript and isolated production build passed, ESLint 0 errors / 20 existing warnings. Real authenticated Support success remains untested here. No new indexes required.

## Release gate and commands

Before approval: obtain successful authenticated Support GET and safe runtime credential/IAM confirmation, confirm ordinary-marketplace activation is intended, preserve this snapshot and coordinate the compatible application. Refresh policy comparison if cloud settings change. No further index deployment is needed given the reported 202/202 READY result.

After explicit approval, in a coordinated maintenance window:

```powershell
Set-Location E:\ThrottleHub_codex_code
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.json --project throttlehub-9d6b9 --only firestore:rules
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.json --project throttlehub-9d6b9 --only storage
npm run dev
```

Restart compatible localhost application with the verified credential environment; test fresh owner/foreign/anonymous sessions and support signals/attachments. Hosting and Functions deployment are not included. Prior public-launch media/abuse/retention limitations remain separate blockers.

Rollback must use the newly preserved actual private-tester snapshot after explicit review/approval, not the old deny-all snapshot. It would reinstate cohort-only client access, and may be incompatible with new profile saves/support signals. Coordinate app rollback, preserve private contacts and indexes, stop affected trusted routes, and never reopen private data. No rollback deployment or config was executed.
