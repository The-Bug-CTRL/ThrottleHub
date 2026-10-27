> Current localhost/private-cloud plan: [FIREBASE_PRIVATE_TEST_READINESS.md](FIREBASE_PRIVATE_TEST_READINESS.md). Latest verification: **169 tests,29 files;155 prepared indexes**. This document preserves its earlier audit snapshot where superseded. No cloud deployment was performed.

> Current integration decision: **NO-GO for public launch**. See [final deployment report](FIREBASE_DEPLOYMENT_GO_NO_GO.md) for the unified configuration, latest 157-test result, fresh verified backup, remaining blockers and exact release/rollback commands. Earlier observations below are historical where superseded.

# Seller accounts and motorcycle running videos

Implemented in the existing ThrottleHub Next.js/Firebase application, building on the uncommitted local security audit. No site rebuild, new authentication system, paid video provider, cloud deployment, production data change, Git commit or push was performed.

## Personal and Business accounts

Registration offers an explicit Personal or Business choice for email registration and first Google sign-in. Firestore Rules require the explicit choice on newly created profiles, so a direct SDK call cannot silently create a new legacy-shaped account. An existing Google profile keeps its current account type. Business selection requires a business name. Both use the same Firebase Authentication identity and existing public `profiles/{uid}` document.

Account Settings can switch types without changing UID or deleting listings, messages, favourites, reviews or follow relationships. Personal settings retain name, photo URL, biography and general location. The existing Google photo continues to work; profile photographs and business logos can also use public HTTPS image URLs. A new logo/avatar upload pipeline was not invented.

Business profiles support:

- Required business name.
- Logo URL, description and business category.
- Existing public province and town/city fields.
- HTTPS website.
- Optional, explicitly public business telephone, email and operating hours.
- Existing active-listing pagination, reviews and follows on the public storefront.

Business categories are dealership, parts retailer, riding equipment retailer, workshop, professional trader and other business. Brown `#78543D`, charcoal `#272725` and off-white `#FAF9F6` account cards/forms use the existing design and collapse to one column on mobile.

Business Seller is **self-declared**, not Verified Business. There is no automatic verification badge, paid plan or client-editable verification/role field. Strict profile/business field allowlists reject attempted `admin`, `verifiedBusiness` or nested `verified` fields. A future verification feature must use an independently protected administrator-controlled record; it must not overload the editable business object.

Listings/cards show Private Seller or Business Seller. Search retains the compatible internal `private`/`dealer` values, with the Business Seller display label. The server derives listing seller type from the account, rather than trusting the form's seller-type field. Drafts follow the current account type; first publication captures the seller identity type. Existing published/historical adverts retain their captured type, with the old `details.sellerType` as fallback, rather than rewriting history after an account change. The public storefront shows the account's current type.

Legacy profiles remain readable and usable without bulk writes: missing `accountType` maps to Personal unless the legacy `sellerType` is `dealer`, which maps to Business. A legacy business owner supplies the required business name when saving the expanded settings. Changing Business to Personal removes the public business object; it does not erase related marketplace records. Previously published business contacts may still exist in caches or independently retained copies.

## Required motorcycle video

The requirement uses the actual taxonomy's `itemType === "motorcycle"`; it is not title/description matching. Motocross, enduro, hard-enduro branches, trials, trail, pit bikes and kids-bike branches are included. Motorcycle model year does not create an exemption. Parts, riding gear, electronics, accessories and tools are exempt.

The Photos & Price stage provides a required running-video section with device selection, supported mobile camera capture, resumable upload progress, cancel, retry, preview, replacement and removal of the form selection. Drafts may be saved without video. An accepted video is needed for successful motorcycle publication, including saving an edited active motorcycle or changing a non-motorcycle advert into a motorcycle.

Instructions ask for the actual motorcycle, starting where possible, idling and brief running footage. Cold starts are welcomed only when shown. Sellers are told to avoid excessive revving, unsafe riding or enclosed operation. Electric demonstrations show safe powered operation instead of engine sound. A video/audio track is not proof of the correct bike, genuine engine sound, cold start, ownership or mechanical condition; those remain seller declarations and manual moderation concerns.

Supported initial contract:

- One selected accepted video per motorcycle advert.
- 15–60 seconds inclusive.
- At most 100 MiB (`104857600` bytes; displayed explicitly in the UI).
- Maximum 1280×720 or 720×1280, including smaller portrait/landscape clips.
- MP4 output with H.264 8-bit standard-colour video and AAC audio.
- Petrol demonstrations require an audio track. Listings explicitly marked two-stroke/four-stroke cannot use the silent-electric declaration. Electric demonstrations may be silent.
- MOV/HEVC/WebM uploads are not offered as supported formats. Mobile cameras may produce incompatible recordings; users must export a compatible H.264/AAC MP4. The backend accepts only media it can fully decode and stream-copy into the supported MP4 output; there is no HEVC/WebM transcoding fallback.

No non-running/project exemption was added. A future dedicated, visibly labelled non-running/project condition can require a condition video instead, with a separate approved publication contract. There is currently no “skip running video” checkbox or moderator flag that bypasses this requirement.

## Trusted upload and validation lifecycle

`POST /api/listings/{id}/videos` verifies a nonrevoked Firebase ID token and derives the caller UID from it. JSON bodies are limited to 2 KB. `begin` checks the listing owner, eligible status and participation restriction, then creates a server-owned upload slot with an expiry and private quota record. There are at most six upload starts per account per rolling hour and twelve per rolling day across all adverts.

Storage staging path:

```text
listing-video-uploads/{ownerUid}/{listingId}/{serverGeneratedVideoId}.mp4
```

Only the authenticated slot owner can create a staged object. The slot must be uploading, unexpired and associated with that UID/listing. Rules cap size and MIME and require an absent object. Overwrite is denied. Users cannot upload directly into accepted video storage or mutate validation metadata.

After resumable upload completes, `validate` atomically leases the private video record. The server:

1. Checks actual object size/MIME and downloads a fixed Storage object generation into a unique temporary directory.
2. Inspects file bytes/container with `ffprobe`, not the filename or supplied MIME alone.
3. Checks video/audio streams, H.264/pixel format, AAC, duration, dimensions and petrol audio presence.
4. Fully decodes the bounded clip with FFmpeg, rejecting decoding errors.
5. Stream-copies supported codecs into a fresh fast-start MP4, dropping container metadata and chapters. This is remuxing, **not transcoding** or paid analysis.
6. Creates an immutable accepted object with controlled Storage metadata and a new playback capability token.
7. Deletes staging bytes before committing the final ready record. It rechecks listing ownership/status/restriction in the final transaction.

Accepted path:

```text
listing-videos/{ownerUid}/{listingId}/{videoId}.mp4
```

FFprobe has a 30-second bound; full decoding and remuxing each have a 120-second bound. External execution uses argument arrays without a shell and restricts input protocols to local file/pipe. Two validations per server process may run concurrently; callers receive 429 when busy. This is not a global multi-instance limit or substitute for infrastructure quotas/App Check. Current FFmpeg security updates and a runtime sandbox/resource policy remain operational requirements.

Failure leaves a failed/private record and cannot satisfy publication. Clients can discard an unattached upload; they cannot discard a video currently referenced by the advert. Accepted object writes/deletes are denied to every Firebase client, including staff clients; trusted services perform lifecycle cleanup.

The backend does not treat client-written `ready`, `videoVerified`, duration or audio flags as authoritative. Only server-owned private video records can satisfy the transaction. The returned public copy is a display snapshot, not a client authority source.

## Publication, relisting and retained history

The existing trusted `mutateListing` transaction enforces the requirement for:

- Initial motorcycle publication and draft-to-published transitions.
- Published motorcycle saves and category changes.
- Reactivation of expired/on-hold motorcycles, including legacy records.
- Video replacement/removal attempts.

The ready record must match owner UID, listing ID, accepted path, validation version, format, size, duration/dimensions, audio requirement and immutable generation. Publication and relisting also fetch the actual accepted object metadata and require matching generation, byte count and MP4 MIME; a missing or changed object fails closed. Direct Firestore publication and client edits of the protected video/seller snapshot fields remain denied. Clients cannot delete an accepted video while leaving an active listing.

An expired/on-hold motorcycle has an Add Video and Relist flow through Edit. It attaches accepted media while reactivating the same advert, preserving historical details and URL. Other items can use the existing ordinary reactivation control without being asked for motorcycle footage. Sold adverts remain immutable history and cannot be relisted.

The detail player is prominent beside the existing photo gallery, uses normal controls/fullscreen/mobile playback, and labels seller-supplied footage clearly. Neither cards nor search download video. A player source is attached only after the buyer chooses Watch; `preload="none"` avoids eager video transfers. The first advert photograph serves as the optional poster. Unavailable playback shows a fallback. The existing Report Listing action accepts unsafe, unrelated or misleading video concerns and sends them to the existing moderation queue.

Sold, expired and on-hold videos remain available through the same public status policy as their advert. Their URLs/IDs are not reset and routine sale does not delete media. Restriction, permanent removal and anonymisation invoke the existing trusted cleanup service, now extended to staged/accepted videos and private video records. Deletion revokes live bearer-token object access; removal may be HTTP 202 with a visible pending-cleanup warning if Storage cleanup fails. It must be monitored and retried.

Public playback is `GET /api/listings/{id}/video`: the server applies the existing public listing guard and checks ready metadata before redirecting to the accepted object. A returned token URL is a bearer capability; it must not be treated as independently expiring authentication. Draft/staged objects are not returned by this route. Private evidence and other bucket paths are not opened by these changes.

## Firestore and Storage changes

| Path/field | Purpose and authority |
| --- | --- |
| `profiles/{uid}.accountType` | `personal` or `business`; self-declared owner settings. |
| `profiles/{uid}.business` | Strict public business map: name/logoURL/description/category/website/phone/email/hours. Province/city remain existing profile fields. |
| Existing `profiles/{uid}.sellerType` | Compatible `private`/`dealer`, required to agree with the explicit account type. |
| `listings/{id}.sellerAccountType` | Trusted publication snapshot; not a claim of verification. |
| `listings/{id}.runningVideoId` and `.runningVideo` | Current accepted video ID and display metadata, set by the trusted listing transaction. |
| `listings/{id}/videos/{videoId}` | Server-owned uploading/processing/ready/failed/discarded lifecycle; owner/admin reads only, no client writes. |
| `postingLimits/{uid}/videoQuota/current` | Server-only hourly upload counter; client access denied by default. |
| `listing-video-uploads/...` | Expiring owned staging, no public read, create only. |
| `listing-videos/...` | Accepted immutable bytes; owner/admin or the exact public listing reference can read; all client writes denied. |

Video metadata includes path, owner UID, listing ID, content type, bytes, duration, dimensions, audio presence, declared petrol/electric demonstration, upload/validation dates, validation version and object generation. Public playback availability is derived from listing status rather than trusting an editable public flag. No binary data is stored in Firestore.

The prior security work remains present. [Updated permission matrix](FIREBASE_PERMISSION_MATRIX.md), [Firestore Rules](firestore.rules), [Storage Rules](storage.rules) and [index catalogue](audit/firebase-index-catalogue.md) cover the added contracts. There are now **160 composite indexes**. The addition is `videos` with `COLLECTION_GROUP` scope, `status ASC, createdAt ASC`, for trusted cleanup scans. Firebase clients have not been given collection-group access.

## Orphan cleanup and privacy operations

`scripts/video-maintenance.ts` defaults to read-only dry-run. It scans video records older than 24 hours, skips the current referenced video regardless of whether the advert is active or historical, skips recent processing, and transactionally claims eligible orphans before deleting only their known staging/accepted paths. Claiming prevents the same ready record being published while it is being deleted. Pagination advances beyond retained references. Account quota records are bounded to one document per user.

The maintenance command and an index are supplied; **a daily scheduled run has not been installed or deployed**. Deploying/scheduling it requires separate approval. A staging-prefix bucket lifecycle backstop can also be considered, but no bucket retention/lifecycle policy was changed. Server crashes may leave temporary local files until the host's temp cleanup and processing records until maintenance; monitor both.

The application still has no complete self-service account-deletion service. Operator account deletion must run listing removal/anonymisation plus `finishListingMedia` for every owned advert before finalizing the relevant identity/privacy request, along with the existing chat/review/follow retention process. Merely deleting Auth is not media cleanup. Bucket soft deletion also affects physical retention, as noted below; legal/privacy policy must account for it.

## Migration and actual cloud observations

No destructive migration or fake inventory was performed. Existing active adverts are not automatically hidden for lacking a video; the detail page explains when an older motorcycle has no footage. Editing/relisting requires meeting the new contract. A read-only legacy audit reports missing-video listing IDs.

Read-only host-side checks on 23 October 2026 established:

- Project and Web app match `throttlehub-9d6b9`.
- Firestore is Standard/Native in `africa-south1`; Storage bucket/project match and Storage location is `AFRICA-SOUTH1`.
- The legacy audit scanned **0 currently published cloud listings**, with zero writes.
- Current deployed Firestore and Storage policies are still the initial **deny-all rules**. The cloud has **0 composite indexes**. The locally tested application policies/indexes are not deployed.
- Email/Password and Google provider configuration reads returned **HTTP 403**. This account lacks permission to verify them; do not infer disabled or enabled from that response.
- A complete read-only policy/index/bucket backup was saved in ignored `.tools/cloud-security-backup/2026-10-23T19-26-23.165Z`. This supersedes the initial audit's earlier inability to obtain a cloud backup. Treat the snapshot as deployment preparation and preserve it securely.
- The bucket reports legacy `REGIONAL` class naming and a **604800-second / seven-day soft-delete policy**. Neither was changed. Live deletion revokes ordinary access, but soft-deleted bytes can remain recoverable by authorized operators and billable during retention.

New registration/profile writes, uploads and client reads will be denied in real cloud mode until the coordinated reviewed policies/indexes are deployed with approval. Use `npm run dev:emulator` for local feature testing meanwhile. This is not solved by opening temporary public rules.

## Current cost example

USD list pricing checked 23 October 2026. Google's public Billing Catalog returned SKU **`4EC6-27CA-3AA0`, Standard Storage Johannesburg**, effective `2026-10-23T07:00:00Z`, at **$0.020 per GiB-month**. Regional is the legacy regional Standard-equivalent class naming. [SKU catalogue](https://cloud.google.com/skus?currency=USD&filter=4EC6-27CA-3AA0), [legacy storage classes](https://docs.cloud.google.com/storage/docs/storage-classes), [pricing evidence](audit/video-pricing-2026-10-23.json).

Example internet playback uses **$0.12/GiB** for worldwide destinations excluding the separately priced destinations, within the first 10 TiB/month. [Google Cloud Storage pricing](https://cloud.google.com/storage/pricing). Assumptions: one 20 MiB clip per advert and ten complete plays per clip per month; retries/partial playback vary.

| Motorcycle videos | Live storage | Monthly storage | Playback/month | Example playback charge | Combined example |
| --- | ---: | ---: | ---: | ---: | ---: |
| 100 | 1.95 GiB | $0.04 | 19.53 GiB | $2.34 | $2.38 |
| 1,000 | 19.53 GiB | $0.39 | 195.31 GiB | $23.44 | $23.83 |
| 10,000 | 195.31 GiB | $3.91 | 1,953.13 GiB | $234.38 | $238.28 |

At the maximum 100 MiB per clip, storage/playback are five times these volumes and approximate charges. For 10,000 maximum-size clips and ten full plays each: 976.56 GiB live storage, $19.53/month storage and about $1,171.88 playback, before other usage.

These examples exclude request operations, Firestore reads/writes, runtime decoding/remux CPU, temporary staging, seven-day soft-deleted copies, taxes and currency conversion. For one new 20 MiB upload per advert, seven retained days of the deleted staging original add approximately 23.3% of one month's original-byte storage, before other replacements/deletions. Validation creates one accepted copy and deletes staging; it does not keep permanent duplicate originals.

Do not subtract US-only free-tier allowances from this Johannesburg estimate. New `firebasestorage.app` buckets follow Cloud Storage regional pricing; Always Free eligibility is limited by region. [Firebase bucket pricing changes](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024). No subscription, billing configuration or region was changed.

Storage is the smaller cost here; delivery dominates. Reassess CDN/dedicated video delivery when measured monthly egress reaches roughly 1–2 TiB, watch counts grow, or adaptive bitrate/device conversion becomes necessary. This is an evaluation trigger, not a universal break-even: compare actual delivery prices plus platform minimums, encoding, caching, operations and migration costs. No such provider has been added or purchased.

## Tests and deployment prerequisites

See [feature test results](audit/seller-video-test-results.md) for final counts, commands and limits. Tests use only isolated `demo-throttlehub-tests` emulators and temporary local synthetic video fixtures. They include real FFmpeg/ffprobe inspection, decoding/remuxing, Storage upload/download/delete, publication/ownership gates, snapshots, cleanup, relisting and the previous security suite. Synthetic fixtures are never seeded into the real project.

Browser/device QA remains necessary: real camera output varies; actual Google consent, business-form interactions, mobile fullscreen, authenticated draft preview CORS, upload cancellation/retry and slow connections have not all been exercised through a connected browser. Audio-track detection cannot verify that the sound is an engine, or that the depicted bike matches the advert.

Before an approved release:

1. Confirm Auth providers/authorized domains in Firebase Console with a suitably authorized account. Review the saved cloud policies, index inventory and prior audit blockers.
2. Install maintained FFmpeg/ffprobe in the **existing Next.js server runtime**. Optional server-only `FFMPEG_PATH` and `FFPROBE_PATH` select explicit executables. Do not put these or server credentials into `NEXT_PUBLIC_*` variables.
3. Provide writable temporary disk (at least 400 MiB plus headroom for two simultaneous maximum clips), sufficient CPU/memory, process execution and a route timeout compatible with the 300-second validation route. Host the server near the Johannesburg bucket to avoid unnecessary inter-region traffic. Do not assume every serverless host includes these binaries/resources.
4. Deploy and wait for required indexes to become READY; emulators do not enforce composite indexes.
5. Coordinate application and rules release, including the previous audit's reply payload change. Install/monitor the approved daily orphan maintenance schedule. Keep a known-good policy snapshot and compatible application rollback plan.
6. Run explicitly authorized live acceptance with designated real accounts/content; do not seed fake bikes. Keep the prior security audit's broader App Check/abuse/privacy requirements in the release plan.

Prepared commands, **not executed**:

```powershell
# Approved policy/index deployment only; no Hosting or Functions.
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.json --project throttlehub-9d6b9 --only firestore:indexes
# Wait for index readiness before coordinated application/policy activation.
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.json --project throttlehub-9d6b9 --only firestore:rules
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.json --project throttlehub-9d6b9 --only storage
```

Read-only operational commands:

```powershell
node --import tsx scripts/video-maintenance.ts --audit-legacy
node --import tsx scripts/video-maintenance.ts
```

The first audits active legacy adverts; the second is cleanup dry-run. Cloud cleanup after separate explicit approval:

```powershell
node --import tsx scripts/video-maintenance.ts --apply --approved-cloud-maintenance
```

The explicit cloud-maintenance switch is an operational safeguard, not evidence that approval has already been granted. No cloud cleanup was run. Do not pass apply flags for migration review. Use the same project-scoped rollback plan and verified backup from the prior audit; do not roll back into public writes or blindly remove required indexes.

## Files and handoff

New account modules: `src/lib/seller-account.ts`, `src/components/seller-account-fields.tsx`.

New video modules: `src/lib/running-video.ts`, `video-inspection.ts`, `video-service.ts`, `video-maintenance.ts`; `src/components/running-video-upload.tsx`, `running-video-player.tsx`; listing `videos` POST and `video` GET routes; `scripts/video-maintenance.ts`.

Updated existing flows: auth/account/seller pages; listing form/detail/cards/seller labels; models and public listing projection; trusted lifecycle/media cleanup; Firestore and Storage Rules; index generator/catalogue; environment example comments; scoped styling and tests. No package/dependency or external paid service was added. Existing uncommitted security changes were preserved.

The earlier lifecycle/workflow tests now explicitly seed server-owned ready fixtures where the test concerns historical listing behavior. Those fixtures do not pretend to validate bytes; the new video suite separately performs real file validation end to end. New tests also cover profile field/privilege boundaries, player no-preload behavior, categories and protected API identity.

**Readiness:** implemented and locally tested, but not yet production-enabled. Current cloud deny-all policies/zero indexes, provider-verification permissions, FFmpeg runtime provisioning, daily cleanup scheduling and live device acceptance remain release prerequisites. The broader outstanding security/privacy items in the previous audit still apply unless explicitly superseded here.
