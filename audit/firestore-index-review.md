# Firestore index review � 23 October 2026

Original:160. Removed:6. Added:1 photo maintenance group index. Final:**155**. No cloud indexes were changed; actual cloud inventory remains empty. No exact duplicate definitions were found.

## Removed definitions and evidence

- Five stolenReports indexes: status + make/model/year/region/city + createdAt DESC without country. All public stolen directory queries inject country=ZA in use-page-query.ts; public server readers also constrain country. Owner queries use ownerId; moderator lists use the single-field date index. The country-prefixed counterparts and all 32 combined filter subsets remain.
- listings:status,country,currency,__name__ ASC. getListing now uses a direct document lookup and tests public status in code. Marketplace/feeds order by createdAt or price; owner listings use their owner/date index. No current caller has the removed query shape.

## Preserved families

| Collection | Definitions | Current caller family |
| --- | ---: | --- |
| listings | 82 | src/lib/marketplace-search.ts; src/lib/server.ts; owner account queries |
| forumThreads | 10 | src/components/use-page-query.ts; forum pages; src/lib/notification-feed.ts |
| replies | 2 | forum detail and notification reply queries |
| newsArticles | 4 | news directory and homepage recent feed |
| stolenReports | 36 | src/components/use-page-query.ts (injects ZA); stolen directory combined filters; src/lib/server.ts publicDocument; owner reports |
| events | 6 | event directory endsAt bounds/type/direction; homepage upcoming; publicDocument |
| reviews | 2 | src/app/api/profiles/[id]/reviews/route.ts pagination and histogram |
| conversations | 3 | participant messaging, interaction evidence and notifications |
| directoryPosts | 7 | jobs/entries/services directory and public document queries |
| messages | 1 | notification sender/time filters |
| videos | 1 | src/lib/video-maintenance.ts private group cleanup |
| photos | 1 | src/lib/photo-maintenance.ts private group cleanup |

Every retained definition: [ordered catalogue](firebase-index-catalogue.md). Four taxonomy levels (0�3), four marketplace sort/direction options, optional token search and province each have active code branches. Equality-filter merging may make some of the 26 higher-order stolen-filter combinations unnecessary; these are candidates, not confirmed deletions. Keep them until approved cloud Query Explain/representative queries confirm the planner and scan costs. Array-search indexes are intentionally retained to avoid index-merging performance loss. No runtime/production Query Explain was executed.

## Storage and write impact

There are 40 array-search and 42 scalar listing composites. A fully populated deep-category advert contributes approximately 40 � tokenCount + 42 composite entries. tokens() caps at350. Missing fields reduce entries; shallow categories cost less. Default single-field indexes add further entries.

Illustration assumes160�320 bytes/entry, not measured live data; long paths/values can exceed this. Assumes10,000 fully populated adverts and no free allowance:

| Tokens/advert | Composite entries/advert | Index GiB | USD/month at0.156/GiB-month |
| --- | ---: | --- | --- |
| 100 | 4042 | 6.02�12.05 | $0.94�$1.88 |
| 350 | 14042 | 20.92�41.85 | $3.26�$6.53 |

These are index-only storage examples, excluding document/single-field/storage media, requests, bandwidth, backups and taxes. Firestore bills a document set/update as one document write; it does not bill one additional document write per composite entry. Fanout still increases internal write work, latency and index-entry/size-limit risk. With explicit document-ID ordering and a range/order field, query index-entry reads may also be charged; sparse marketplace refinement can fetch up to128 documents per response and returned results can be fewer. Do not estimate search cost from the eight returned cards alone.

Johannesburg Standard catalogue rates verified read-only: reads $0.031/100,000, writes $0.094/100,000, deletes $0.010/100,000, database/index storage $0.156/GiB-month, before free quota/discounts. Evidence: [public catalogue records](firestore-pricing-2026-10-23.json).

Sources: [Firestore billing](https://firebase.google.com/docs/firestore/pricing), [index merging](https://firebase.google.com/docs/firestore/query-data/index-overview#use_index_merging), [entry size](https://firebase.google.com/docs/firestore/storage-size), [location pricing](https://cloud.google.com/firestore/pricing). This is a planning estimate, not a usage forecast or cloud billing change.
