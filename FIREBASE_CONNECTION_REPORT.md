# ThrottleHub Firebase connection report

Target project: **throttlehub-9d6b9**. Supplied Web app configuration is now in the ignored `.env.local`. No cloud deployment, cloud role grant, fictional listing, seeded inventory, website deployment or Cloud Function deployment was performed. Git was not initialised.

## 1. Configuration supplied and still needed

All six supplied Firebase Web configuration values have been entered exactly in `.env.local`. They are not copied into this report or checked-in examples.

| Variable | Purpose / state |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_MODE` | `development`: real cloud services in this existing application; not emulation |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `throttlehub-9d6b9` |
| `NEXT_PUBLIC_FIREBASE_DEV_PROJECT_ID` | `throttlehub-9d6b9`: deliberate cloud-project confirmation |
| `GCLOUD_PROJECT` | `throttlehub-9d6b9`: server project must match browser project |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Already populated from the supplied `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Already populated from the supplied `authDomain` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Already populated from the supplied `storageBucket` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Already populated from the supplied `messagingSenderId` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Already populated from the supplied `appId` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Still needs an authorised existing server credential path, unless service-account ADC/workload identity is otherwise provided |
| `NEXT_PUBLIC_SITE_URL` | Deliberately unset during local testing, retaining noindex. Set only when a genuine site origin is approved. |

For a local existing service-account JSON file, set the commented `GOOGLE_APPLICATION_CREDENTIALS` line in `.env.local` to its absolute path outside the repository, or set that variable in the shell that starts Next.js. Do not paste private keys into client variables or chat. No service-account file was supplied, created, downloaded or fabricated.

The Admin SDK uses `applicationDefault()` on the server and an explicit project ID. Prefer authorised service-account ADC, workload identity, or a supported service-account impersonation setup. Ordinary Firebase CLI login is not a server credential. Ordinary gcloud end-user ADC also has Firebase Authentication limitations; do not assume CLI login alone will fix token verification. See https://firebase.google.com/docs/admin/setup . Runtime credentials should have only the needed Firestore read/write and Auth read access; metadata verification may separately require viewer permissions. No IAM roles were granted by this work.

## 2. Configuration separation and code changes

- `.env.local` is the real cloud profile, with no emulator endpoints.
- The previous offline profile was preserved in ignored `.env.emulator.local`; `.env.emulator.example` is the shareable offline template.
- `.env.example` stays offline. `.env.cloud.example` shows the cloud variable names with no API key, application ID or sender ID filled in.
- Environment profiles and service-account-style credential filenames are ignored by Git. Keep real credentials outside the workspace regardless of ignore patterns.
- `.firebaserc` deliberately retains safe default `demo-throttlehub`, with separate `cloud` and `emulator` aliases. Deployment commands below explicitly specify the real project, never rely on the default.
- `start-dev.bat` / `npm run dev` use `.env.local` and print the REAL target before starting the existing Next.js application. In cloud mode they do not start emulators.
- `start-dev-emulator.bat` / `npm run dev:emulator` select the separate emulator profile and start offline services. The local admin bootstrap is pinned to that offline profile and still cannot grant cloud roles.
- The test runner ignores the cloud profile and pins all services to `demo-throttlehub-tests` on isolated ports 8180/9299/9298. It does not receive the real server credential path.
- Client and Admin SDKs use the default app explicitly and refuse stale project reuse. Server startup rejects mismatched projects or mixed cloud/emulator endpoints.
- Auth explicitly uses browser-local persistence before sign-in. Password reset messaging now distinguishes cloud email delivery from local emulator links. Page state resets on account changes, while the in-progress Auth flow remains mounted.
- Public server reads query only public records before reading documents. Private drafts/hidden content cannot enter development server-render traces through these readers. Public profiles select only their allowed public fields.
- Profile membership creation times can no longer be backdated or changed. Role/admin/email fields remain disallowed on public profiles.
- Storage rules now enforce ZA/ZAR for public listing images, ZA for public stolen-bike photos, existing parent ownership for uploads, positive file sizes and the existing 5 MB/type limits. Admin image access supports moderation. Private evidence remains authenticated and does not use public download links in the UI.

Restart the existing development terminal before switching profiles. Do not start a second emulator session on occupied ports. No existing user development process was terminated by this task.

## 3. Authentication checks

Enable **Email/Password** and **Google** in Firebase Console > Authentication > Sign-in method for `throttlehub-9d6b9`. Google also needs a configured project support email. Add `localhost` and `127.0.0.1` to Authentication's authorised domains, without ports; add the actual hosted domain only when it exists. New Firebase projects do not automatically authorise localhost. See https://firebase.google.com/docs/auth/faq-and-troubleshooting .

Existing flows reviewed: registration, Google popup sign-in, idempotent Google profile creation, email/password login, sign-out, password reset, auth-state restoration, private account pages, token-based role checks and notification API token verification. No email addresses or Google tokens are copied into public profiles.

Emulator tests passed for registration/login, incorrect passwords, sign-out, password-reset code verification/confirmation, Google provider identities and custom-claim administration. Browser-local persistence is configured in code; browser reload/cross-tab behaviour and the real Google popup still need manual checks after the cloud providers/domains are verified. Emulator identities do not prove that real Google OAuth configuration is enabled.

Current remote verification status: this session's read-only Firebase CLI request failed authentication, and the read-only server check could not obtain authorised ADC. Therefore live providers, IAM, billing, database location/edition, bucket configuration, deployed policies and remote index readiness are **not yet independently verified**. The supplied project ID and Web config have been validated locally; the Johannesburg database and Blaze status remain owner-supplied facts until the read-only cloud check succeeds.

## 4. Rules review and initial-testing assessment

The locally tested rules are suitable for controlled initial testing **after deployment and cloud verification**. This is not a claim that an uninspected currently deployed cloud ruleset is safe, or that all abuse/cost risks have been eliminated. Do not use real private evidence while the deployed rule state is unknown.

| Area | Access boundary reviewed |
| --- | --- |
| Listings | Published ZA/ZAR public; drafts/hidden owned records private; immutable owner/id/creation fields; category and model/path validation |
| Images | Owner staging; parent ownership checks; image type/size limits; public status/country/currency checks; admin moderation access |
| Profiles | Public-field whitelist; immutable membership date; no admin/moderator/private email fields |
| Favourites and saved searches | Isolated under the authenticated member; cross-user access rejected |
| Messaging | Participants only; sender identity protected; participants/ownership cannot be rewritten |
| Forum/replies | Public published records; ownership, moderator permissions, lock and posting-cooldown checks |
| News/articles | Published content public; trusted admin writes only |
| Stolen reports | Moderation before publication; private evidence/tips restricted to owner/moderators; ZA publication boundary |
| Events | Published ZA events public; administrator writes |
| Member reviews | Interaction evidence; no self-review or forged authors; subject replies cannot change scores; moderation protected |
| Jobs/entries/services | Owner submissions pending; owner edits return to approval; moderators control publication |
| Notifications | Verified Firebase ID token; server derives owner UID; private read state and no raw message body in feed |
| Administration | Custom token claims only; users cannot grant roles using public documents; no automatic real admin bootstrap |

Firebase Admin bypasses client Security Rules. Its routes were checked separately: public readers enforce publication filters; private notifications verify ID tokens and derive their member ID on the server. The Admin SDK is behind `server-only`; no private key is bundled into the client.

Public listing/news/photo URLs generated by `getDownloadURL` are bearer links. Someone who already has such a URL may retain access after an advert is hidden. Private evidence uses authenticated reads instead. File MIME/size checks are not malware scanning. Email verification is sent but is not currently a publication prerequisite. Before opening unrestricted registration to the public, review abuse controls and billing limits separately.

## 5. Automated validation

- **72 tests passed in 12 files**, including the Firebase Emulator Suite and isolated workflows.
- Added cloud/default-app mismatch and mixed-endpoint guards, successful confirmed cloud config, membership/privilege tampering rejection, password-reset completion, oversized uploads, private draft/foreign image reads, and upload-parent ownership checks.
- Existing new-feature tests cover category artwork/aliases, deep marketplace filters, reviews, moderation, Jobs/Services and private notification feeds.
- TypeScript checking passed.
- Targeted ESLint checks passed after correcting a test-only const declaration. Full-project lint also passed with 0 errors and 18 existing warnings (image optimisation and hook dependencies); see `.tools/firebase-cloud-lint.log`.
- Production build passed in an isolated copy without replacing the running development server's `.next` output.
- Initial test failures were fixed: UTF-8 BOM in the new Storage rules, and a workflow test refreshing a stale signed-out User instance after switching accounts. The final full run has no failures.

Logs: `.tools/firebase-cloud-audit-tests.log` and `.tools/firebase-cloud-build.log`. Those ignored logs may contain short-lived reset links for isolated emulator users; they are not live credentials or seed inventory.

## 6. Indexes and Storage browser downloads

`firestore.indexes.json` now has **133 unique composite definitions**, maintained by `scripts/indexes.mjs`. Additional definitions cover publication-filtered public record lookups and descending forum-reply activity. Existing marketplace, province, review, directory and notification indexes are retained. Automatically provided single-field indexes are used for simple status/document-ID lookups rather than adding redundant composites.

Emulators do not enforce the full deployed composite-index requirements. After approval, deploy the catalogue and wait for all required indexes to finish building. No filters should be removed to work around an index error.

`storage.cors.json` is prepared for authenticated GET/HEAD downloads from `http://localhost:3000` and `http://127.0.0.1:3000`. Private evidence downloads use `getBlob`, which needs browser CORS support; see https://firebase.google.com/docs/storage/web/download-files . This is separate from Firebase Storage Security Rules. CORS does not replace authorisation. Add a real hosted origin only when approved.

Storage rules read Firestore documents, so the Firebase Rules/Storage service agent must have the required cross-service permission. The deployment may request that configuration. It has not been granted or verified here. Existing download tokens on older uploads are not revoked by deploying rules.

## 7. Read-only checks before deployment

These commands do not deploy or create users/listings/objects:

```powershell
cd E:\ThrottleHub_codex_code
npm run firebase:check
npx firebase login
npx firebase apps:list WEB --project throttlehub-9d6b9
npm run firebase:verify-cloud
```

`firebase:check` validates local IDs and required values without printing the API key or credential contents. `firebase:verify-cloud` uses server ADC to read project/Web app metadata, Firestore location/edition, bucket/project identity, email/password settings, Google provider status and local authorised Auth domains. If a service account lacks metadata-viewer permissions, a particular check can remain unverified even when its narrower runtime permissions are sufficient. Do not broaden runtime IAM automatically to satisfy a verification utility.

To repeat isolated tests:

```powershell
npm run test:integration
npm run typecheck
```

## 8. Exact proposed deployment commands -- NOT EXECUTED

Only run these after the owner reviews the completed tests and explicitly approves deployment to **throttlehub-9d6b9**:

```powershell
cd E:\ThrottleHub_codex_code
npx firebase deploy --only firestore:rules --project throttlehub-9d6b9
npx firebase deploy --only firestore:indexes --project throttlehub-9d6b9
npx firebase deploy --only storage --project throttlehub-9d6b9
```

These deploy the checked-in Firestore rules/indexes and Storage rules only. They do not deploy the website, Functions, or inventory. If Firebase CLI offers to remove remote indexes not present in this catalogue, stop and review the proposed deletions rather than accepting them blindly; the remote catalogue has not been inspected yet.

The separate proposed CORS change also needs approval; it has not been run:

```powershell
gcloud storage buckets update gs://throttlehub-9d6b9.firebasestorage.app --cors-file=storage.cors.json --project=throttlehub-9d6b9
```

The gcloud command was not available on this session's PATH. No Google Cloud SDK installation or system configuration was performed.

## 9. Safe live testing after approval

1. Provide authorised server credentials, verify the project/providers/domains using the read-only checks, and approve the policy/index/CORS changes before using real private records.
2. Complete only the approved deployments; wait for indexes to be ready. Check that Firestore/Storage have the intended rules rather than open test mode. Keep the cloud admin bootstrap disabled until a real administrator UID is separately identified and authorised.
3. Stop the old development terminal with Ctrl+C. Start `start-dev.bat`; its startup message must name the REAL `throttlehub-9d6b9` project and must not start emulators. Continue to use `start-dev-emulator.bat` for offline work.
4. Use your own genuine account: register with email/password, check verification mail, sign out/in, reload the page to confirm persistence, and request a real password reset. Test Google with your own Google account and check its profile is preserved on a second sign-in.
5. With a genuine item you own, save a private draft and upload your own ordinary photo. Confirm its document/object are in the intended Firebase project. Do not publish fabricated test adverts or upload private ownership evidence for a smoke test.
6. Confirm another signed-out or separately authorised account cannot see the draft, favourites, messages or private evidence. Use emulator tests for destructive, fabricated and privilege-escalation cases. If you test messaging live, use real consenting accounts and genuine communications.
7. Browse real published records as they are added. Check province/category filters and the bell. Have an authorised real administrator verify moderation with genuine submissions; do not self-grant claims from the browser.
8. Review Firebase usage/errors and clean up your own abandoned draft/uploads through the normal authorised workflow. Do not run bulk imports, seeds or deletions against the cloud project.

Approval gate: **no cloud deployment has been run.** Server credentials and provider/IAM verification remain prerequisites; owner approval is still required for every proposed cloud deployment above.
