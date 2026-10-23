# ThrottleHub V1.5 development status

## UI redesign update

The entire route set now uses Dirt & Stone and locally hosted Manrope, with a new charcoal shell, compact marketplace homepage, mobile navigation/filter panels, photo gallery, selling stages/review/success, garage layout, dedicated auth/reset screens, real-data inbox previews/unread indicators, shared dialogs and consistent community/editorial/moderation styling. See DESIGN_SYSTEM.md and UI_REVIEW.md. Backend contracts and Security Rules are preserved; model-year filtering adds indexed structured constraints.

Inbox previews/unread indicators derive from bounded latest-message listeners (at most the 30 visible conversations) and existing readAt values, with public profile names. Historical pagination remains limited; no new denormalized messaging fields were introduced. Profile saves now preserve existing member-since/location settings instead of resetting them.

## Implemented

Removal of application fixtures, generated motorcycle artwork, default sellers/prices, preview branches/environment flags, routine seed scripts and fixed-account documentation. Central ThrottleHub name, original vector/typographic wordmark, consistent navigation/metadata and community footer. No application record is automatically created. The only neutral content asset is a no-photo placeholder.

Combined Windows startup launches empty Firebase emulators and Next in one terminal. Explicit configuration modes separate emulator routing from a confirmed non-production cloud development project. Missing configuration, unavailable services, permission failures and successful empty results do not fall back to invented content. Tests are isolated by project and ports.

Existing real marketplace features remain: browse/search/filter/cursor pagination, country/worldwide, public SSR listing/seller pages, Auth registration/login/reset/verification, seller dashboard, own listing create/draft/edit/publish/sold/archive, compressed photos, favourites, participant-only messages, reporting and admin moderation. Added model/subcategory/state controls use actual structured constraints. Missing images use a neutral placeholder.

Forum: ten real configuration categories, actual aggregate counts, prefix/category filtering, active/latest ordering, topic creation, safe text/link rendering, chronological paginated replies, own edit/soft-remove, reporting, moderator hide/lock and enforced atomic 15-second posting cooldown. Public profiles show recent real discussions.

News: public published-only directory and SSR article pages, metadata, categories/keyword, bylines/dates, covers/captions, related content/sharing. Admin editor supports create, draft, edit, image upload, publish, unpublish and delete.

Stolen motorcycles: moderated pending/public/recovered/rejected/archived lifecycle, real directory/filter/detail pages, owner reports/resubmission/recovery/archive, private information submission, restricted case/serial/ownership evidence, moderator publication/disputes/audits and no public suspect fields or automatic seller accusations. Evidence uses authenticated downloads rather than UI-generated bearer links.

Events: admin create/edit/draft/publish/unpublish/delete and public paginated upcoming/past views/details. Server queries separate past/upcoming using end time; event start/end are stored as epoch instants with local-time entry labels.

## Limitations and launch gates

- No browser is exposed to the automation tools here. Desktop/mobile rendering, keyboard, client-console and full UI interaction flows still need visual QA; backend/HTTP checks are not a substitute.
- Arbitrary multi-filter Firestore combinations may need additional indexes. Queries surface explicit errors; no filter is silently ignored. Emulator success cannot certify deployed indexes. Single keyword/prefix only; exact model/location matches; no live FX or relevance search.
- Editorial workspace lists latest 30 records; inbox lists 30 conversations/50 recent messages; private tips list latest 20; existing seller dashboard lists 40 and public profiles 24 listings/8 topics. Broader historical pagination remains required for scale; current inbox unread indicators are implemented. Forum/news/stolen public directories and forum replies have cursor pagination.
- Basic forum cooldown and role-protected participation restrictions exist, but complete anti-spam automation, global rate limiting, App Check enforcement, blocked-member UX and Auth account suspension are not implemented.
- Public image download tokens can outlive unpublishing. Add image validation/EXIF stripping, token revocation/delivery policies, orphan cleanup, evidence retention/ownership review and private-storage browser CORS verification. Published theft photos/descriptions require human review for identifying data or accusations.
- Text supports escaped paragraphs and https links only. Rich-text editing, inline editorial image layouts and forum attachments are deferred. No news aggregation or manufactured journalism.
- Policy pages remain review drafts. Operator/support contacts, data export/deletion, retention schedules, POPIA procedures, final domain/canonical strategy, live sitemap and launch approval remain outstanding. All routes remain noindex.
- No fixed or real remote credentials were added. Cloud development needs the owner's explicit project configuration and server credentials. No remote connection, Git operations, deployment, purchase or reset occurred.

See VERIFICATION.md for executed checks, FEATURE_REFERENCE.md for researched product patterns and V2_BACKLOG.md for next work. Do not treat compilation or emulator permissions alone as clearance for real users.
