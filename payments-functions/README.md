# ThrottleHub payments Functions

Dedicated `throttlehub-payments` codebase, Node 22, Firebase Functions v2. HTTP webhooks and Scheduler reconciliation: `europe-west1`. Firestore workers: `africa-south1`, database `(default)`; Firebase CLI derives Eventarc's trigger location from that database. This source is independent of the existing content-import Functions. Do not deploy the whole project or initialize a Functions project over the existing importer source.

The shared `src/core` service is used directly by Next.js and by these Functions. It has no frontend simulation/fulfilment endpoint. Hosted checkout uses official Paystack Initialize/Verify APIs. Refunds are initiated by an authorized operator in Paystack; this code never sends an automatic refund or charge outside hosted checkout.

Build locally:

```powershell
npm ci --prefix payments-functions
npm --prefix payments-functions run build
```

Prepared TEST secret command (**cloud change: owner approval first**):

```powershell
node node_modules/firebase-tools/lib/bin/firebase.js functions:secrets:set THROTTLEHUB_PAYSTACK_TEST_SECRET_KEY --config firebase.payments.json --project throttlehub-9d6b9
```

Enter the real `sk_test_…` key at the interactive prompt. Never paste it into a source file or chat. The live secret is not needed for Test exports.

Prepared selective TEST deployment (**not executed**):

```powershell
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.payments.json --project throttlehub-9d6b9 --only "functions:throttlehub-payments:paystackTestWebhook,functions:throttlehub-payments:processPaystackTestEvent,functions:throttlehub-payments:reconcilePaystackTestPayments"
```

`firebase.payments.json` contains Functions only. This command targets three exact Test exports, never Rules, Storage, Hosting, existing content codebases or the Live exports. The checked-in CLI's selector parser and local endpoint manifest were inspected; actual cloud deployment/IAM/Eventarc/secret access remains untested.

See [PAYSTACK_PROMOTIONS.md](../PAYSTACK_PROMOTIONS.md) for schemas, indexes, local configuration, real test-mode acceptance, monitoring, reversals and the separately gated Live release.
