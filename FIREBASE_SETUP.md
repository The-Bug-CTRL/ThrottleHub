> Firebase connection update: .env.local now targets the real throttlehub-9d6b9 project. Use start-dev-emulator.bat (or npm run dev:emulator) for offline development. See [FIREBASE_CONNECTION_REPORT.md](FIREBASE_CONNECTION_REPORT.md) for server credentials, approval-only deployment commands and verified test results. No cloud policies have been deployed by this change.

# Firebase setup

## Local, empty development

`start-dev.bat` runs `scripts/dev.mjs`. It uses project-local Node/Java when available, isolated Firebase CLI preferences/cache and `.env.local`. If the latter does not exist, it copies `.env.example`. It starts Auth 9099, Firestore 8080, Storage 9199, UI 4000 and Next 3000, then creates **no users or content**. There is no import, seed or sample-data fallback. The `demo-` prefix is Firebase's offline project safety mechanism; it does not imply any demonstration records.

The everyday ID is `demo-throttlehub`. Previous project namespaces are not read, reset or deleted. Unknown local records and all remote data are untouched. Ctrl+C stops owned services; local records are ephemeral. Use the website to register your own first account and publish your own item.

Configuration:

```text
NEXT_PUBLIC_FIREBASE_MODE=emulator
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-throttlehub
NEXT_PUBLIC_FIREBASE_API_KEY=local-emulator-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-throttlehub.firebaseapp.com
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-throttlehub.appspot.com
GCLOUD_PROJECT=demo-throttlehub
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
```

The local web API key is only an emulator setting; it is not a fabricated cloud credential. The launcher refuses backend port collisions. Separate-services workflow: `start-emulators.bat`, then `npm run dev:web` in `local-terminal.bat`. Keep the configured project consistent. Do not weaken Windows execution policies; batch shortcuts do not require PowerShell script execution.

## Explicit real development project (not connected here)

When you supply an authorised, **non-production** Firebase web app:

1. Set NEXT_PUBLIC_FIREBASE_MODE=development.
2. Set NEXT_PUBLIC_FIREBASE_PROJECT_ID, API_KEY, AUTH_DOMAIN and STORAGE_BUCKET to that project's actual web app configuration.
3. Set NEXT_PUBLIC_FIREBASE_DEV_PROJECT_ID to the same exact project ID as explicit confirmation, and GCLOUD_PROJECT to the same ID for server readers.
4. Remove Firestore/Auth/Storage emulator host variables from .env.local and the terminal. The combined launcher strips inherited emulator routing in development mode and does not start emulators.
5. Configure server Application Default Credentials belonging to that same development project through your normal authorised process. Never put a service-account private key into NEXT_PUBLIC variables, source control or browser code.
6. Enable Email/Password Auth, add authorised local domains, configure Firestore/Storage location, and apply the reviewed Rules/indexes only after authorising changes to that development project. This iteration performs no remote configuration or deployment.
7. Restart Next after any environment change. Recheck Storage CORS for authenticated private evidence downloads in browser-based development.

Missing mode/configuration displays a setup state; mismatched projects fail closed. Firebase connection failures and permission denials have separate messages. An empty successful query is an empty state, never a trigger to fabricate content. No runtime can independently certify that an arbitrary supplied project is non-production: the owner must supply/confirm the appropriate development project.

## Roles

See ADMIN_BOOTSTRAP.md. No fixed account/password is created. Admin and moderator claims cannot be set through public profiles, signup forms or Firestore writes. Cloud role grants require a separate trusted and explicitly authorised process.

## Automated tests

`test-local.bat` / `npm run test:integration` launches its own `firebase.test.json`: Firestore 8180, Auth 9299, Storage 9298, hub 4401 and websocket 9151. Project `demo-throttlehub-tests` is completely separate from everyday development. The test runner checks exact loopback endpoints before clearing its own test data, creates random temporary credentials/claims, cleans data and shuts down owned emulators. It works while ordinary development services run. No manual fixture/seed step.

## Before accepting real users

Review and deploy Rules/indexes to authorised isolated staging, verify every query there, configure App Check and broader abuse controls, inspect/strip image metadata, implement image revocation/cleanup and private evidence retention, add privacy deletion/export processes, finalise operator/support details and legally review policies. Verify public SSR status guards and admin authorization again. App Hosting configuration is retained; framework support/version compatibility must be rechecked before any future authorised deployment. No deployment command is supplied by this workflow.
