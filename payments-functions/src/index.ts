import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { PaystackProvider } from "./core/paystack.js";
import { enqueueWebhook, processWebhook } from "./core/webhooks.js";
import { reconcilePayments } from "./core/reconcile.js";
import {
  PaymentError,
  assertLiveEnabled,
  type PaymentEnvironment,
} from "./core/catalogue.js";
initializeApp({ projectId: "throttlehub-9d6b9" });
const test = defineSecret("THROTTLEHUB_PAYSTACK_TEST_SECRET_KEY"),
  live = defineSecret("THROTTLEHUB_PAYSTACK_LIVE_SECRET_KEY");
const options = {
  region: "europe-west1",
  maxInstances: 2,
  timeoutSeconds: 120,
  memory: "256MiB" as const,
};
function context(environment: PaymentEnvironment) {
  assertLiveEnabled(environment);
  if (
    process.env.GCLOUD_PROJECT &&
    process.env.GCLOUD_PROJECT !== "throttlehub-9d6b9" &&
    !process.env.FIRESTORE_EMULATOR_HOST
  )
    throw new Error("Payments project mismatch");
  return {
    db: getFirestore(),
    environment,
    provider: new PaystackProvider(
      environment,
      environment === "test" ? test.value() : live.value(),
    ),
  };
}
function webhook(environment: PaymentEnvironment) {
  const secret = environment === "test" ? test : live;
  return onRequest(
    { ...options, secrets: [secret], invoker: "public", cors: false },
    async (req, res) => {
      try {
        if (req.method !== "POST") {
          res.status(405).send("POST required");
          return;
        }
        const raw = req.rawBody;
        if (
          process.env.GCLOUD_PROJECT &&
          process.env.GCLOUD_PROJECT !== "throttlehub-9d6b9" &&
          !process.env.FIRESTORE_EMULATOR_HOST
        )
          throw new PaymentError("Payments project mismatch.", 503);
        if (!raw || Number(req.headers["content-length"] || 0) > 131072)
          throw new PaymentError("Webhook too large.", 413);
        await enqueueWebhook(
          getFirestore(),
          environment,
          raw,
          req.headers["x-paystack-signature"],
          secret.value(),
        );
        res.status(200).json({ received: true });
      } catch (error) {
        logger.warn("Payment webhook rejected", {
          environment,
          status: error instanceof PaymentError ? error.status : 500,
        });
        res
          .status(error instanceof PaymentError ? error.status : 500)
          .send("Webhook not accepted");
      }
    },
  );
}
function worker(environment: PaymentEnvironment) {
  return onDocumentCreated(
    {
      ...options,
      // Co-locate the worker with Firestore. Firebase CLI derives the Eventarc
      // trigger location from this database, not from HTTP/Scheduler options.
      region: "africa-south1",
      database: "(default)",
      document: `paymentWebhookEvents${environment === "test" ? "Test" : "Live"}/{eventId}`,
      retry: true,
      secrets: [environment === "test" ? test : live],
    },
    async (event) => {
      await processWebhook(context(environment), event.params.eventId);
    },
  );
}
function schedule(environment: PaymentEnvironment) {
  return onSchedule(
    {
      ...options,
      schedule: "every 15 minutes",
      timeZone: "UTC",
      retryCount: 3,
      secrets: [environment === "test" ? test : live],
    },
    async () => {
      const result = await reconcilePayments(context(environment));
      logger.info("Payment reconciliation", { environment, ...result });
      if (result.failures)
        throw new Error(`${result.failures} payment operations need retry`);
    },
  );
}
export const paystackTestWebhook = webhook("test");
export const processPaystackTestEvent = worker("test");
export const reconcilePaystackTestPayments = schedule("test");
// Selective deployment of the three Test exports does not bind/require a live secret.
// These Live exports additionally fail closed until the explicit runtime gate is set.
export const paystackLiveWebhook = webhook("live");
export const processPaystackLiveEvent = worker("live");
export const reconcilePaystackLivePayments = schedule("live");
