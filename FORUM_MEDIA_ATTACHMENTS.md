# Forum photo, video and GIF attachments

29 October 2026. Local implementation for ThrottleHub. Nothing deployed; no live forum/customer records changed. Paystack and the listing running-video workflow are unchanged.

## Experience

New discussions, replies and edits use the same media composer. Add Photos, Add Video and Add GIF open real file pickers; Attach Link validates HTTPS YouTube links and provides the existing click-to-load preview. Up to three links can be attached through the control. Existing URLs in post text remain editable there, including legacy Vimeo links; Vimeo is no longer advertised in the composer.

Uploads show a local preview, queued/uploading/processing/ready state, percentage progress and useful format/limit errors. Remove/cancel and retry work; replacement is remove then choose another file. Cancelled or disconnected processing can finish server-side, but cannot attach itself to a post and is cleaned as an orphan. Files upload sequentially in each composer to avoid competing for the shared processing limit. Publish waits for successful validation. Failed requests never appear as ready attachments.

Published photos use a responsive gallery, lazy loading and native modal lightbox. Video and animation bytes are not requested until clicked; video has native controls, playsInline, no autoplay and preload=none. GIF animation is opt-in, including for reduced-motion users; Stop animation removes it. No third-party GIF provider or paid media API is introduced. Preview controls use actual selected files, not decorative thumbnails. No separate video poster is generated; the preview/player is loaded on request.

## Formats and limits

| Kind | Input limits | Trusted result |
| --- | --- | --- |
| Photos | JPEG/PNG/WebP, 5 MiB each; 24MP decode limit; 5 per post | EXIF orientation applied, metadata stripped, max 1600px JPEG, quality 84 |
| Video | 1 MP4, 50 MiB, >0 to 60 seconds, up to 1080p portrait/landscape and 60fps | H.264 standard colour, optional single AAC track, full decode followed by metadata/chapters-stripping remux |
| GIF | 1 GIF, 5 MiB, <=100 frames, <=10 seconds, <=1280px per side, <=20 million aggregate frame pixels | Animated WebP, max 640px, metadata stripped, <=8 MiB output |

HEIC/HEIF, HEVC, MOV and other unsupported phone formats are rejected with export guidance; this does not pretend all mobile camera formats work. Filename and browser MIME are not accepted as proof of format. Photo/GIF decoding is bounded and timed; FFprobe, full FFmpeg decode and remux have separate timeouts. No minimum 15-second engine demonstration or petrol audio requirement is imposed on forum clips.

## Architecture and authorization

- POST /api/forum/media issues a random, owner-bound 15-minute upload slot for one exact thread/reply target, checking ownership, parent publication/lock and suspension.
- PUT /api/forum/media?id=... verifies a revocation-checked Firebase ID token, claims the slot transactionally, then bounds the HTTP body before decoding. Upload input goes to the existing Next.js server, not to an arbitrary bucket path. Temporary video files are removed in finally blocks.
- Ready objects live under forum-media/{uid}/{randomId}.jpg|webp|mp4. Only the trusted server writes them. No Firebase bearer download token is generated. A failed commit deletes its object; deterministic cleanup paths cover crashes before ready-record commits.
- POST /api/forum/posts creates/edits text and attachments together. It checks owner/restriction/locked parent, trusted profile author name, limits, exact media target and ready/attached state, and verifies actual Storage generation, byte count and MIME before publishing. Client processed/ready flags are ignored. Two-way transactions protect publication from cleanup/discard races.
- Attachment references add an optional attachments array of IDs/kinds to the existing forumThreads/replies documents. Original IDs, authorship, creation dates, reply ordering, search tokens and moderation/reporting structures remain. Existing posts need no backfill.
- Owner removal uses DELETE /api/forum/posts so attachment-bearing threads remain removable without opening direct-write permissions. Existing moderator hide/remove and locking tools stay enforced by their original Rules.
- GET /api/forum/media verifies the attached thread AND reply are still published and still reference the media, or permits only the owner to preview an unexpired ready upload with an ID token. It supports bounded single byte ranges, checks immutable object metadata and streams bytes with no-store/nosniff. Removing/replacing/hiding a post stops subsequent reads. Already delivered bytes cannot be recalled; an in-flight response may finish after moderation.

Firestore remains default-deny: explicit deny blocks added for forumMedia, forumMediaQuotas, forumMediaControl and forumPostLimits. Storage explicitly denies all client reads/writes under forum-media. Existing direct text-only operations remain valid; clients cannot add attachment fields directly. No existing permissions were weakened. New attachment posts require the compatible editor/API for editing; reload old tabs. No additional composite index is needed: the existing 202 remain untouched. Cleanup uses the default single-field sweepAt index.

## Admission, retention and moderation

Transactional limits span arbitrary draft IDs: 20 upload starts/account/24h, at most 3 videos; platform totals 200 starts/24h and at most 30 videos. A failed/cancelled upload does not refund admission. Two processing leases are enforced in Firestore across processes/instances, expiring after ten minutes for crash recovery. The route runtime must enforce <=300 seconds; processing timeouts fit within that bound. Post creation retains the 15-second cooldown; trusted post creates/edits are capped at 60/account/hour.

Unpublished ready/failed/abandoned records are eligible after 24h; discarded/replaced records immediately. The worker transactionally marks a record discarded before deletion, preventing later publication. Current visible references are retained and rescheduled for inspection after 30 days. Hidden/deleted posts become eligible at their next scheduled inspection (within roughly 30 days plus scheduler delay); playback is blocked immediately. This retention is for accidental-removal review, not indefinite orphan storage. Bucket soft-delete may separately retain deleted bytes; the inspected 28 October metadata snapshot reports seven days.

pruneForumMedia is included in the existing --all-media maintenance script and ops/media-maintenance.ps1 locking/logging/failure-exit workflow. It scans at most 100 due records per invocation, defaults to dry-run and retries failed deletions on later runs. **A monitored scheduler is not installed or activated by this task.** Schedule after separate approval; inspect removed/retained/more counts and nonzero exits, and alert if a run fails or due records accumulate. Use repeated scheduled batches if more=true. Do not use Firestore TTL alone: deleting metadata first would strand Storage files.

Users report inappropriate topics/replies through the existing report tools; staff can hide or remove the post and its media visibility together. There is no automated visual-content classifier, copyright detector or antivirus guarantee. Existing suspension checks block uploads/publication. Global quotas limit Sybil upload volume but do not replace broader abuse controls or delivery budgets. Public GET traffic is not rate-limited here; monitor and protect hosting/egress before broad public launch.

## Runtime, costs and manual release

Inspected existing FFmpeg/photo infrastructure, normal firebase.json, App Hosting configuration and the completed bucket metadata snapshot. Reuses the existing Johannesburg bucket; no new bucket, Functions or paid service. The listing pipeline is unchanged except reuse of its safe container-remux utility. apphosting.yaml still does not provision FFmpeg or prove request limits.

Production prerequisites: maintained FFmpeg/ffprobe binaries, Sharp native runtime, writable temporary space, enough memory for two 50 MiB buffers plus decode overhead (provision/test at least 1 GiB), >=400 MiB temporary-disk headroom, 300-second processing allowance and an ingress/body limit supporting 50 MiB. Some managed hosts reject large bodies before Next.js; verify the chosen host before enabling video uploads. maxDuration alone is not proof. Keep processing close to the bucket to reduce transfer costs. App Hosting runtime remains a deployment prerequisite, not a claim of verified hosting support.

Illustrative volume: 100 videos averaging 20 MiB consume about 1.95 GiB storage; ten complete plays each transfer about 19.5 GiB. At illustrative unit assumptions of $0.02/GiB-month storage and $0.12/GiB delivery, that is roughly $0.04 storage plus $2.34 delivery, excluding operations, CPU, photos, retained deleted bytes, taxes and hosting-specific charges. These are scenario assumptions, not a project quote. Proxy delivery can incur hosting egress and cross-region transfer in addition to Storage operations. Each playback request/range performs bounded authorization/document and object metadata reads. Public delivery has no spending cap. Check actual regional SKUs and set alerts before release. [Cloud Storage pricing](https://cloud.google.com/storage/pricing), [App Hosting configuration](https://firebase.google.com/docs/app-hosting/configure).

Approval-gated release order (NOT executed):

```powershell
Set-Location E:\ThrottleHub_codex_code
node scripts/check-firebase-config.mjs
node scripts/check-media-runtime.mjs
node scripts/backup-firebase-security.mjs
# Preserve and review the completed current cloud backup first.
# No index deploy needed for this feature; verify existing required indexes/default sweepAt index.
node scripts/check-firebase-index-readiness.mjs
# Only after explicit approval, deploy the reviewed normal policies:
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.json --project throttlehub-9d6b9 --only firestore:rules
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.json --project throttlehub-9d6b9 --only storage
# Release the compatible Next.js app through its separately approved hosting process.
# For localhost:
npm run dev
# Read-only maintenance inventory:
.\ops\media-maintenance.ps1
# Only after separately approving cleanup/scheduling:
.\ops\media-maintenance.ps1 -ApprovedCloudMaintenance
```

The final command includes existing photo/video maintenance too; review its full scope. Configure an hourly monitored Windows task or equivalent trusted scheduler for the approved command using existing scoped credentials, no public cleanup URL. No IAM change, credential provisioning, schedule registration or deletion was performed. Never apply a generic bucket-age deletion rule that would remove still-published forum media. No CORS change is needed for same-origin forum uploads/playback. Genuine live two-account acceptance remains required before public release.

Photo/GIF implementation references: [Sharp constructor bounds and animated input](https://sharp.pixelplumbing.com/api-constructor/), [Sharp output options](https://sharp.pixelplumbing.com/api-output/).

## Final validation

- Full isolated Firebase Emulator Suite/application integration: **278 tests passed across 55 files, zero failures, exit 0**. Includes actual image/GIF/video processing, attachment ownership/publication/removal, hidden-parent access, quota and cleanup checks, API failures, static media rendering, and existing marketplace/payment/support regressions.
- TypeScript passed. ESLint: **0 errors, 24 warnings** (20 existing and four native-image optimization warnings in the media UI).
- Isolated production Next.js build passed, exit 0; the running development build was preserved. `git diff --check` passed.
- Evidence: `.tools/release-security-tests.log`, `.tools/release-security-tests-exit.json`, `.tools/release-security-build.log`, `.tools/release-security-build-exit.json`, `.tools/forum-media-lint.log`.
- Rules loaded successfully in the isolated emulators. No new composite indexes are required; the existing 202 definitions were not changed by this feature.

These are local automated checks, not live or mobile-device acceptance. Real phone file pickers, upload cancellation/retry interactions, lightbox gestures, browser video playback and hosted request limits still need acceptance on the chosen runtime. No fictional live posts were created. Public activation remains conditional on runtime verification, monitored cleanup scheduling and live two-account acceptance; no deployment is authorized by these results.
