# ThrottleHub architecture and shared contracts

The existing Next.js App Router / React / strict TypeScript / Tailwind / Firebase stack is retained. One central backend supports the South African launch with ZA/ZAR listings. The inactive country catalogue remains extensible; there is no active worldwide browsing or foreign-currency publication. No checkout or escrow. [MARKETPLACE_V2.md](MARKETPLACE_V2.md) supersedes the original marketplace/search description below with the current taxonomy, bounded server search, private saved searches and migration policy. Community contracts below remain in place.

## Trust boundaries

Firebase Authentication supplies identity; Firestore and Storage Security Rules apply to direct SDK operations on web and future Flutter clients. Claims `admin: true` and `moderator: true` come only from trusted role-management operations. Public profile fields cannot assign privileges. Admin can publish official articles/events; moderators can manage forum/stolen content but cannot publish official news.

Server-only Admin SDK readers explicitly constrain status before rendering public content, because Admin bypasses Rules. No arbitrary server write endpoint was introduced. Environment validation rejects missing configuration, mismatched project confirmations and cloud IDs in emulator mode. No fixture fallback exists when connections fail.

Collections use stable IDs, owner UID and epoch milliseconds for content timestamps. The rate-limit token uses Firestore Timestamp. Schemas in `src/lib/models.ts` and `src/lib/community-models.ts` are framework-independent. Future Flutter must implement the same field names, rules, canonical role checks and publication lifecycle, with equivalent validation in Dart.

## Existing marketplace

- `listings/{id}`: id, immutable ownerId/createdAt, title, slug, description, category/subcategory, make/model/year, specs, price/currency, country/region/city, condition, shipping, ordered images, status, updatedAt, searchTokens. Status: draft, published, sold, hidden. Owner cannot republish an admin-hidden advert.
- `profiles/{uid}`: public displayName, bio, approximate city/country, sellerType and createdAt. No private email or exact address. Seller type is self-declared, never a verification badge.
- `users/{uid}/favourites/{listingId}`: private listingId/createdAt. Other private subcollections are reserved, not a finished saved-search product.
- `conversations/{listingId_buyerUid}`: immutable buyerId, sellerId, participants, listingId, listingTitle, createdAt. Creation validates the actual published listing owner and forbids buyer-to-self. Authenticated reads of non-existing conversation IDs allow an idempotent create transaction; existing conversations and list queries remain participant-only. `readAt` changes are restricted to the caller's key.
- `conversations/{id}/messages/{id}`: immutable senderId/text/createdAt. Only participants can read and send; sender must match caller. Existing inbox caps: 30 conversations, 50 recent messages.
- `listingReports/{id}` and `moderationActions/{id}`: existing authenticated report and admin-only review/audit workflow.

New listing creation does not attempt an unauthorised read of a nonexistent private document; edit paths load only owner-accessible records. Missing photographs use a neutral no-photo asset, never example inventory.

## Forum

- Categories are controlled configuration in `community-models.ts` (ten labels/descriptions). No content records are preloaded.
- `forumThreads/{id}`: title/body/category, ownerId, authorName, slug, status (published/hidden/deleted), locked, createdAt/updatedAt/lastReplyAt, searchTokens. Author names come from public profiles; identity fields are immutable. Owners edit body/tokens, soft-remove their topics; moderators hide/lock. Locked/hidden topics reject member edits and replies.
- `forumThreads/{id}/replies/{id}`: ownerId, authorName, body, status, createdAt/updatedAt. Chronological 20-item snapshot cursor pages. Authors edit/remove their own posts; moderators hide. Removal is soft; no public author replacement or participant spoofing.
- `postingLimits/{uid}`: lastPostAt (serverTimestamp). Topic/reply creation atomically writes this token. Rules use getAfter and request.time to enforce 15 seconds between accepted creations, not merely a disabled UI button.
- `restrictions/{uid}`: moderator-controlled suspended/reason/actorId/updatedAt. Suspended members cannot create topics/replies or edit forum posts; they cannot remove their own restriction. This is a participation restriction, not an Auth identity suspension.
- `forumReports/{id}`: targetId, optional replyId, reporterId, reason, status, createdAt. Only moderators read/review.

Topic counts use actual Firestore count aggregations. Directories load 12 topics per page with latest/active sorting and category or one-token prefix search. Body rendering escapes HTML through React, preserves paragraphs and only linkifies https URLs. No raw HTML renderer or rich-text execution.

## Editorial and events

- `newsArticles/{id}`: ownerId, title, slug, body, summary, category, authorName, caption, coverImage, status (draft/published), createdAt/updatedAt/publishedAt, searchTokens. Public gets only published documents. Admin drafts do not leak into public feeds/SSR.
- `events/{id}`: ownerId, title/body/type, startsAt/endsAt, country/region/city/venue, organizer, https link, status, createdAt/updatedAt. Public upcoming/past directories apply bounded end-time range queries and cursor pagination, not a whole-collection download. Admins create/edit/publish/unpublish/delete.

Article public pages include real metadata, canonical ID/slug, byline, cover caption, safe body, sharing and up to three related articles. Editor workspace loads the latest 30 records; older-record editor navigation needs further pagination before large editorial operations.

## Stolen motorcycles — public/private separation

- `stolenReports/{id}` public candidate: ownerId, make/model/year/colour/features, stolenDate (YYYY-MM-DD), country/region/city, general description, ordered public images, status, createdAt/updatedAt, searchTokens. Schema allowlists explicitly exclude evidence, police references and full identifier fields.
- Status transitions: members create pending only; pending/rejected edits return to pending; moderators approve/reject/archive or record recovery; owners may mark their published report recovered or archive their own record. Owners cannot self-approve or replace a reviewed public account without review. Public directories/SSR include only published/recovered.
- `stolenReports/{id}/private/evidence`: ownerId, policeCase, frameId, engineId, note, paths. Readable by report owner and moderators; writable only by report owner. It is not returned by public SSR readers.
- `stolen-evidence/{ownerUid}/{reportId}/{file}`: restricted JPEG/PNG/PDF up to 5 MB. UI stores object paths and downloads with authenticated getBlob; it never generates public evidence download URLs. User-uploaded public photos must not include identifying documents; moderation must check photos/captions before approving.
- `stolenReports/{id}/tips/{id}`: senderId/text/createdAt. Signed-in members submit information privately; only report owner and moderators read. Latest 20 tips are displayed; historical tip pagination remains work.
- `stolenFlags/{id}`: inaccurate/malicious-report flags, moderator-only review. `communityActions/{id}`: append-only role-protected actor/target/action/time audit records generated by moderation UI.

Reports are user-submitted claims reviewed for publication, never independently verified facts. No suspect fields, public contact addresses or automatic seller accusations. Members are directed to safe private information and relevant authorities.

## Search, indexes and cost

Marketplace: 8-document cursor pages; community directories: 12; replies/queues: 20. Prefix tokens are lowercased ASCII prefixes up to 20 characters, capped at 350 values. One keyword at a time; no typo tolerance, phrase/relevance search or paid provider. Text longer than the token budget is not completely indexed. Model/location equality is exact and case-sensitive. Listing price ranges require price sorting; mixed-currency comparisons remain nominal.

`scripts/indexes.mjs` regenerates the checked-in index catalog for primary marketplace queries, forum/activity/replies, editorial, report browsing/ownership and event ranges. Arbitrary combinations of many equalities may need another composite index; failed-precondition errors are visible and never silently drop a filter. Emulator tests do not prove deployed index coverage; staging index verification remains required. Count aggregations are bounded server operations, not collection downloads.

## Launch concerns

Public image token URLs can remain usable after unpublishing. Before real users, add server image inspection/EXIF stripping, delivery/revocation policy, unreferenced-upload cleanup, broader rate limits/App Check, deletion/export and legal/operational support. No Cloud Function was needed for the implemented Rules-authorized writes; future privileged operations must use authenticated shared services rather than React-only rules. All local routes remain noindex and the sitemap stays empty pending an authorised canonical domain and production SEO strategy.
