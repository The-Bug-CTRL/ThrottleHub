# Profiles, followers and sign-in testing

## What riders can see

- `/account` remains the private garage: your adverts in all statuses, favourites, and profile settings.
- **View my public profile** opens `/seller/{uid}`. Other visitors can see active public adverts, reviews, photo (if shared), bio, general city/province, seller type, and membership year. Emails, private messages, drafts, restricted adverts and account settings are not included.
- Public profile adverts now have pagination rather than stopping at the first 24.
- A rider can follow/unfollow another profile. Counts link to `/seller/{uid}/connections?tab=followers` and `?tab=following`; each paginated rider card links to that person's profile, adverts and reviews.
- The garage also links directly to the user's public profile/reviews and connections. Visitors are returned to the rider's profile after signing in from its Follow link; sign-in does not automatically follow someone.
- Follow relationships are public, as stated beside the controls and in the development privacy notice.

## Storage and security

Relationships are stored as a reciprocal pair:

```
profiles/{follower}/following/{target}  { createdAt: server timestamp }
profiles/{target}/followers/{follower} { createdAt: server timestamp }
```

The client uses a Firestore transaction. Rules require the signed-in follower, an existing source and target profile, two matching records committed atomically, and server timestamps. Self-following, one-sided changes, timestamp rewrites, extra fields, suspended-user follows, and changes by another user are denied. Unfollow removes both records atomically. Counts are calculated from stored relationships rather than editable profile counters. Repeated follow/unfollow requests are idempotent.

Names, photos and locations are read from the public profile; no email/contact copies are stored in the relationship records. Rules allow an optional HTTPS photo URL on public profiles, while retaining the existing profile field allowlist and immutable membership date. Google photo sync is optional and cannot make a successful sign-in fail merely because public-photo permissions are not deployed yet.

Account-deletion operators must remove both directions of all follows for that account, in addition to the existing listing/privacy review. There is no new automatic account-deletion service or background notification process.

No additional indexes are required: connection pages use direct subcollection reads/counts and document-ID pagination; the public advert query retains its existing filters. No changes were made to Firebase project configuration or Storage rules.

## Google login on localhost

At implementation time `.env.local` selects `development`, project `throttlehub-9d6b9`, with the same `GCLOUD_PROJECT`. `npm run dev` therefore starts the real cloud connection; `npm run dev:emulator` selects isolated local Firebase instead.

1. Stop the current dev command with Ctrl+C.
2. Run `npm run dev` in `E:\ThrottleHub_codex_code`.
3. Confirm the startup message says **REAL Firebase project throttlehub-9d6b9**.
4. Open `http://localhost:3000/auth` and use Continue with Google or email registration/login.
5. In Firebase Console, enable **Google** and **Email/Password** under Authentication → Sign-in method. Add `localhost` under Authentication → Settings → Authorized domains. If accessing via `127.0.0.1`, that host needs authorisation too; using localhost consistently is simpler.

These actions use real accounts and real Firestore data. A Firebase emulator Google picker does not list your real Google accounts: use its **Add new account** option to create a temporary simulated identity. The sign-in page now explains this in emulator mode.

The real Google popup/provider/domain setup was not verified by signing into a personal account during implementation. Provider/domain configuration and live application acceptance testing remain operator steps. Server-rendered public profiles also require the existing Firebase Admin SDK credentials/runtime identity to be configured correctly; successful browser authentication alone does not supply server credentials.

Official references:

- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/auth/faq-and-troubleshooting
- https://firebase.google.com/docs/emulator-suite/connect_auth

## Release

No cloud deployment was performed. The updated profile/follower rules must be deployed before cloud follow/profile-photo writes will work:

```powershell
Set-Location E:\ThrottleHub_codex_code
.\node_modules\.bin\firebase.cmd deploy --only "firestore:rules" --project throttlehub-9d6b9
```

This command is prepared for approval, not executed. Release the updated application through the established hosting process separately. No demo accounts or adverts were created in the real database.

The isolated emulator test runner uses `demo-throttlehub-tests` on loopback ports 8180/9299/9298 and cleans up its own fixtures. Verification logs are `.tools/profile-follows-tests.log`, `.tools/profile-follows-lint.log` and `.tools/profile-follows-build.log`.

Verification passed: **94 tests across 17 files**, TypeScript, and the isolated production build (exit code 0). ESLint has **0 errors and 18 existing warnings**. Tests cover reciprocal follow creation/deletion, repeat requests, public counts, self-follow prevention, other-user writes, missing profiles, one-sided edges, forged timestamps/fields and profile-photo restrictions. No personal Google account or browser UI sign-in was performed.
