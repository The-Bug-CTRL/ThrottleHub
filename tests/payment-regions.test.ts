import { expect, it, vi } from "vitest";
import { createRequire } from "node:module";
vi.mock("firebase-admin/app", () => ({ initializeApp: vi.fn() }));
import * as functions from "../payments-functions/src/index";

it("Firebase CLI derives the Eventarc location from the default database", async () => {
  const require = createRequire(import.meta.url);
  const firestore = require("../node_modules/firebase-tools/lib/gcp/firestore.js");
  const service = require("../node_modules/firebase-tools/lib/deploy/functions/services/firestore.js");
  const lookup = vi
    .spyOn(firestore, "getDatabase")
    .mockResolvedValue({ locationId: "africa-south1" });
  service.clearCache();
  try {
    const endpoint = {
      project: "throttlehub-9d6b9",
      region: "africa-south1",
      eventTrigger: {
        eventFilters: { database: "(default)" },
        region: undefined,
      },
    };
    await service.ensureFirestoreTriggerRegion(endpoint);
    expect(lookup).toHaveBeenCalledWith("throttlehub-9d6b9", "(default)");
    expect(endpoint.eventTrigger.region).toBe("africa-south1");
  } finally {
    lookup.mockRestore();
    service.clearCache();
  }
}, 15000);

type Endpoint = {
  region: string[];
  secretEnvironmentVariables: { key: string }[];
  eventTrigger?: {
    eventType: string;
    eventFilters: { database: string };
    eventFilterPathPatterns: { document: string };
    retry: boolean;
  };
};
it.each(["Test", "Live"] as const)(
  "keeps %s worker in Johannesburg and HTTP/Scheduler in Belgium",
  (environment) => {
    const endpoint = (name: keyof typeof functions) =>
      (functions[name] as unknown as { __endpoint: Endpoint }).__endpoint;
    const worker = endpoint(`processPaystack${environment}Event`);
    expect(worker.region).toEqual(["africa-south1"]);
    expect(worker.eventTrigger).toMatchObject({
      eventType: "google.cloud.firestore.document.v1.created",
      eventFilters: { database: "(default)" },
      eventFilterPathPatterns: {
        document: `paymentWebhookEvents${environment}/{eventId}`,
      },
      retry: true,
    });
    for (const name of [
      `paystack${environment}Webhook`,
      `reconcilePaystack${environment}Payments`,
    ] as const)
      expect(endpoint(name).region).toEqual(["europe-west1"]);
    for (const name of [
      `processPaystack${environment}Event`,
      `paystack${environment}Webhook`,
      `reconcilePaystack${environment}Payments`,
    ] as const)
      expect(endpoint(name).secretEnvironmentVariables).toEqual([
        { key: `THROTTLEHUB_PAYSTACK_${environment.toUpperCase()}_SECRET_KEY` },
      ]);
  },
);
