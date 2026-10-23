> Firebase connection update: .env.local now targets the real throttlehub-9d6b9 project. Use start-dev-emulator.bat (or npm run dev:emulator) for offline development. See [FIREBASE_CONNECTION_REPORT.md](FIREBASE_CONNECTION_REPORT.md) for server credentials, approval-only deployment commands and verified test results. No cloud policies have been deployed by this change.

# ThrottleHub

A dirt-bike and off-road motorcycle marketplace and community built on the existing Next.js / React / strict TypeScript / Tailwind / Firebase application. Four connected pillars: marketplace, community forum, news and stolen motorcycles, plus an admin-published events calendar. All use one Firebase identity and backend, ready for shared Flutter contracts.

There is no public sample inventory, preview database, routine seed process or predefined account. An empty database is a valid starting point. Branding lives in `src/lib/config.ts`; domain and trademark clearance remain outstanding.

The implemented UI uses the Dirt & Stone palette and locally hosted Manrope through Next.js fonts. See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for tokens/components and [UI_REVIEW.md](UI_REVIEW.md) for coverage and the still-required browser review.

The active marketplace is South Africa only (ZA/ZAR), with all nine provinces, 341 hierarchical off-road categories, category-specific selling/search filters and private saved-search management. See [MARKETPLACE_V2.md](MARKETPLACE_V2.md) for query limits, category URLs, Firestore contracts, SEO configuration and the non-destructive transition for older adverts. Notifications are not sent.

## Start on Windows

```powershell
cd E:\ThrottleHub_codex_code
.\start-dev.bat
```

One terminal starts Authentication, Firestore and Storage emulators, waits for readiness, then starts Next.js at **http://127.0.0.1:3000**. Emulator UI: **http://127.0.0.1:4000**. Ctrl+C stops the owned processes. No seed step. No Windows execution-policy changes. The launcher refuses occupied backend ports rather than connecting to unknown services.

Node 22 and Java 21 are required. The existing project-local `.tools` copies are used when present; otherwise install the official runtimes. Dependencies are already installed in this workspace; on a new checkout run `npm install` with Node on PATH. `start-dev.bat` installs missing dependencies. Copy `.env.example` to `.env.local` for local defaults; the launcher does this only if the file does not exist. Local emulator records are ephemeral across restarts; no automatic import/export is configured.

Advanced separate terminals: `start-emulators.bat` starts only Firebase; run `npm run dev:web` from `local-terminal.bat` for Next alone. Do not also run the combined launcher against already occupied ports. `local-terminal.bat` makes project-local tooling available to npm commands.

## First genuine account and listing

Open `/auth`, choose Create account and supply your own email, display name and password. Verification/reset links appear in the emulator terminal locally; a configured development project sends its normal Firebase emails. Open `/sell`, complete the three stages, upload your own photographs and publish. Manage draft, edit, sold and archived states from `/account`. Other signed-in users can save favourites and contact the seller through private messages.

## Community

- `/forum`: ten controlled categories, actual topic counts, keyword/category search, recent activity, discussion creation, chronological paginated replies, owner edits/removal, reporting and moderator locking/removal. Safe plain-text paragraphs and https links. A Rules-enforced 15-second posting cooldown applies to topic/reply creation.
- `/news`: genuine published articles only, category/prefix filtering, bylines, timestamps, cover captions, related articles and sharing. `/admin/editorial` lets admins create, save drafts, publish, edit, upload permitted images, unpublish and delete records.
- `/stolen-bikes`: approved user-submitted reports, filtering, recovery states and private information submission. `/stolen-bikes/report` submits a pending report. Case references, full identifiers and ownership evidence live separately under restricted access. `/admin/community` handles approval, disputes, forum reports and participation restrictions.
- `/events`: upcoming/past published events and detail pages. `/admin/events` manages genuine event records. Events are ordered by end time so ongoing events remain discoverable; confirm local starting times with organizers.

No section is pre-populated. Register through the website before granting the first local administrator role. See [ADMIN_BOOTSTRAP.md](ADMIN_BOOTSTRAP.md): the local-only tool accepts an existing UID and creates no account or password.

## Tests and checks

From `local-terminal.bat`:

```text
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
```

Or run `test-local.bat` from PowerShell to launch the full isolated emulator suite. It uses `demo-throttlehub-tests` on different ports and automatically creates/cleans temporary records. It never populates the everyday `demo-throttlehub` application. No manual test account or seed is required.

See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for explicitly configuring a real **non-production development** Firebase project. None is connected in this workspace. See [ARCHITECTURE.md](ARCHITECTURE.md), [DEVELOPMENT.md](DEVELOPMENT.md), [FEATURE_REFERENCE.md](FEATURE_REFERENCE.md) and [VERIFICATION.md](VERIFICATION.md).

No Git, commits, deployment, purchases or production Firebase changes were performed. This is a functional development implementation, **not yet cleared to accept real users**. Operational support, legal/privacy workflows, stronger abuse/image controls and browser accessibility/layout verification remain launch gates.
