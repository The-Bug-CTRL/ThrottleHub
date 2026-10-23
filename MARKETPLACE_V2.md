# ThrottleHub marketplace V2

Implemented in the existing Next.js/Firebase application. No database replacement, deployment, production connection, inventory import or demo seeding.

## South African launch

`src/lib/marketplace.ts` defines `enabledCountries = ["ZA"]`, `defaultCountry = "ZA"` and `supportedCurrencies = ["ZAR"]`. The inactive country catalogue remains available for future expansion; there are no separate country databases. Existing contract names `country`, `currency` and `region` carry ISO country, currency and province identifiers rather than introducing competing aliases. All nine provinces use ZA-prefixed codes. Town/city is seller-entered general location, with no address or invented coordinates.

Public marketplace queries and server detail readers require ZA/ZAR. Rules deny foreign public reads while retaining owner/admin access to existing records. All new listing writes, including direct Firebase SDK writes, require ZA/ZAR, permitted shipping options and valid category/technical data. Published listings require a supported province. Drafts may leave the province/town empty. Events and stolen reports use ZA defaults and enforce ZA plus a supported province on writes. Public regional directories and server readers exclude foreign content. Forum discussions retain their existing permissions without geographic restrictions.

## Taxonomy and navigation

341 versioned categories, with six roots:

- Motorcycles: motocross, enduro, trials, trail/recreational and vintage/projects.
- Parts & Spares: complete engines; engine/top end/bottom end; transmission; clutch; fuel/intake; exhaust; cooling; electrical; suspension; brakes; wheels/tyres; drivetrain; frame/controls; bodywork; guards; service parts; breaking/donor parts; other parts.
- Riding Gear & Apparel: helmets, boots, clothing, protection, gloves/goggles and bags/hydration.
- Electronics & Technology: GPS/navigation, wearables, tracking/security, ride data, cameras, communication, power and other electronics.
- Accessories & Equipment: transport/storage and riding/pit equipment.
- Tools & Workshop: specialist tools and workshop equipment, including bike stands/lifts.

`src/lib/category-catalogue.json` is platform configuration, not inventory. IDs/slugs are explicit persisted values: edit display names without changing IDs. Parent IDs, ancestors, level, order, active state, item type and filter schema are explicit. Do not repurpose an existing ID. Add compatible categories and regenerate Rules when changing the catalogue. Engine-control components belong under Parts; consumer devices belong under Electronics. Air filters, brake levers, exhaust guards and starter motors have one primary classification rather than duplicate paths. Vintage parts use an attribute with ordinary part categories.

Deep URLs use `/marketplace/<category-id>`, for example `/marketplace/parts/engine/top-end/cylinder-heads` and `/marketplace/electronics/watches-wearables/gps-watches`. Each route has breadcrumbs, child links, a title, description and canonical URL. Unknown/inactive categories return 404. Parent queries include descendants through scalar depth fields `categoryPath.l0`–`l3`, with the ancestor list retained in each listing. Browsing uses progressive selectors with back navigation, searchable category paths, active chips and reset. The same picker is used when selling/editing. Shared navigation, homepage shortcuts, cards, details, favourites, garage and reported-listing moderation use the hierarchy.

Bike Hub's public classifieds were inspected for broad-to-specific navigation and contextual category links: https://bikehub.co.za/classifieds/all-ads . No code, artwork or visual design was copied.

## Search that actually executes

`POST /api/marketplace/search` delegates to a replaceable server provider. Firestore applies publication, ZA, ZAR, selected depth category, optional keyword prefix, sort and (when price-sorted) price bounds. It uses one array operator for text; hierarchical filtering does not consume an array operator.

Additional criteria are applied on the server to bounded candidates, never by downloading the database to the browser: make/model, exact year or year overlap, province, town, condition, price, delivery, engine type, exact cc, maximum known hours, fuel system, OEM/aftermarket, item brand, gear size/system, self-declared seller type and vintage. Model choices depend on make. The catalogue includes all 16 requested makes; it is curated, not an exhaustive historical model database. Sellers may leave make/model unknown instead of asserting unsupported fitment.

Results contain up to eight matching adverts. A request processes at most 128 candidates in batches of 32; at most 128 documents are read, including any unused tail of the final batch. Cursor value plus document ID produces stable tie ordering. The cursor is tied to the selected filters. A sparse candidate page can have zero results and `more: true`: the interface explicitly offers the next page and never claims the whole search is exhausted. Counts are loaded matches, not invented total counts. No expensive category counts are calculated.

This is a practical bounded refinement strategy, not a large-scale relevance engine. Sparse searches can require multiple pages and extra reads. Indexed text is one ASCII keyword/prefix of up to 20 characters; multiple words produce an actionable error. No phrase, fuzzy, semantic, typo-tolerant or relevance search is claimed. Use a category plus make/model/year for searches such as Yamaha YZ250 cylinder heads, or choose GPS Watches directly. Prefix storage is capped at 350 tokens; not all long descriptions are indexed. Town/brand matching ignores case but is otherwise exact; no distance/radius search is claimed. Unknown compatibility never matches a requested year. Missing indexes produce an error without dropping criteria. Deployed index enforcement still needs an authorised non-production staging check because emulators do not enforce composite indexes.

## Selling and compatibility

The existing photo, price, review and publish flow remains. Sellers can search or drill down into categories. Motorcycle/part forms show structured make/model/year and engine details. Parts add seller-provided compatible year range, fuel system, OEM/aftermarket and part number. Unknown year is `0`; empty make/model is unknown. No automatic cross-year fitment is inferred. A supplied range means the seller claims compatibility across that range. Only one make/model with a year range is represented per advert in this V2; multiple disjoint fitment records remain future work.

Gear shows brand and size with UK/US/EU/alpha/cm context. Electronics, equipment and tools show item brand and ordinary condition/description fields, with engine inputs hidden. Power valves/reeds and two-stroke exhausts are filtered separately from four-stroke valve train/headers. Category selection and validation prevent incompatible stroke claims. Details and compatibility warnings appear on the listing; claims are not independently verified. Incomplete drafts are allowed without fabricating price, town, province or description. Publishing applies full validation and requires photographs.

## Firestore and Rules

Existing collections and immutable owner/creation contracts remain. Listings add `categoryId`, `primaryCategoryId`, `categoryAncestorIds`, `categoryPath` and a bounded `details` map. Existing `make`, `model`, `year`, `country`, `currency`, `region`, `city` and `shipping` fields remain. `details` contains engine type/cc/hours, compatibility years, fuel system, part origin/number, item brand, size/system, seller type and vintage flag. Country/currency are expandable through an explicit future launch-policy, schema and Rules update.

Rules validate category IDs, exact path/ancestor data, primary root, category labels, make/model association, technical field shapes and stroke-specific categories. Generated category checks evaluate a small branch rather than constructing the whole catalogue, staying within Firebase's expression budget. Ownership and admin restrictions remain. No trusted write endpoint bypass was added.

Regenerate platform policy and indexes with the existing local Node runtime on PATH:

```text
node scripts/marketplace-rules.mjs
node scripts/indexes.mjs
```

These commands edit local configuration files only. They do not synchronise Firestore, create inventory or deploy Rules/indexes. Review and test generated output before any separately authorised deployment.

## Saved searches

Authenticated users can save the applied criteria, reopen them at `/account/saved-searches`, remove them and paginate through older records. Data lives in `users/{uid}/savedSearches/{id}` with `version: 2`, name, structured filters, creation time and `notificationsEnabled: false`. Rules isolate users and reject notification-enabled claims. Account and mobile navigation link to management. Editing criteria means reopening, changing filters and saving a new search; in-place renaming/editing is not implemented. Email/push delivery and Cloud Functions matching are deferred; the interface explicitly says notifications are not enabled.

## Existing records: non-destructive transition

No records are automatically deleted, rewritten or imported. Existing foreign records remain owner/admin-accessible and are excluded from the South African public site. Owners must not change their location to ZA unless the goods are actually in South Africa.

Old ZA adverts remain available in general browsing and public detail pages, but lack the new depth index until reclassified. Old category links are mapped to sensible broad categories. Opening an owned advert in `/sell?edit=<id>` proposes a compatible category and normalises a recognised province name; the owner reviews the category, unknown model/fitment and location before explicitly saving. Saving writes the new fields and regenerated search tokens. Ambiguous parts must be manually assigned to a specific category. Unknown provinces require a real selection. Legacy make/model values outside the catalogue need review; do not infer fitment. Existing photos, ID, ownership and creation time are retained.

For a larger existing dataset, perform a backed-up, reviewed migration in an explicitly authorised development/staging project: map known labels, leave ambiguous rows for review, derive exact ancestor/path fields from the catalogue, validate each document, use bounded batches and preserve IDs/ownership/timestamps. No production migration command has been executed or enabled automatically. Hide legacy rows from publication through ordinary owner/admin workflows if they cannot yet be classified. Roll out the client, Rules and indexes together; old clients cannot write obsolete category contracts afterward.

## SEO and local operation

Local defaults remain `noindex` with an empty sitemap. A configured `NEXT_PUBLIC_SITE_URL=https://<approved-host>` sets canonical origin and enables category sitemap/robots output. `/browse` filter combinations remain noindex and canonicalise to `/browse`; deep category pages provide stable discovery paths. Do not set a production origin or deploy without the normal launch review.

Start the empty local Firebase application with `./start-dev.bat`, then visit `http://127.0.0.1:3000`. No seed step. Use `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:integration` and `npm run build` from `local-terminal.bat`. The integration command includes Security Rules and SDK journeys against isolated `demo-throttlehub-tests` ports, never everyday inventory. See VERIFICATION.md for the actual latest results and remaining browser QA.
