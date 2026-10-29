import "server-only";
import { getApp } from "firebase-admin/app";
import { adminDb } from "./server";
import { PaystackProvider } from "../../payments-functions/src/core/paystack";
import {
  PaymentError,
  assertLiveEnabled,
  type PaymentEnvironment,
} from "../../payments-functions/src/core/catalogue";
export * from "../../payments-functions/src/core/catalogue";
export * from "../../payments-functions/src/core/promotions";
export function paymentEnvironment(): PaymentEnvironment {
  const mode = process.env.THROTTLEHUB_PAYSTACK_MODE || "test";
  if (mode !== "test" && mode !== "live")
    throw new PaymentError("Invalid payments environment.", 503);
  return mode;
}
export const paymentsEnabled = () =>
  process.env.THROTTLEHUB_PAYMENTS_ENABLED === "true";
const cached = new Map<string, { key: string; until: number }>();
async function secret(environment: PaymentEnvironment) {
  const name =
    environment === "test"
      ? "THROTTLEHUB_PAYSTACK_TEST_SECRET_KEY"
      : "THROTTLEHUB_PAYSTACK_LIVE_SECRET_KEY";
  if (process.env[name]) return process.env[name]!;
  const previous = cached.get(name);
  if (previous && previous.until > Date.now()) return previous.key;
  const token = (await getApp().options.credential!.getAccessToken())
    .access_token;
  const response = await fetch(
    `https://secretmanager.googleapis.com/v1/projects/throttlehub-9d6b9/secrets/${name}/versions/latest:access`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    },
  );
  if (!response.ok)
    throw new PaymentError(
      "Payment credentials are not available to this server.",
      503,
    );
  const value = await response.json(),
    key = Buffer.from(value.payload?.data || "", "base64")
      .toString("utf8")
      .trim();
  cached.set(name, { key, until: Date.now() + 300000 });
  return key;
}
export async function paymentContext(checkout = false) {
  if (checkout && !paymentsEnabled())
    throw new PaymentError("Promotions are not available yet.", 503);
  const db = adminDb(),
    environment = paymentEnvironment();
  const project = getApp().options.projectId || "";
  if (
    project !== "throttlehub-9d6b9" &&
    !(
      project.startsWith("demo-") &&
      process.env.FIRESTORE_EMULATOR_HOST?.startsWith("127.0.0.1:")
    )
  )
    throw new PaymentError("Payments project mismatch.", 503);
  assertLiveEnabled(environment);
  return {
    db,
    environment,
    provider: new PaystackProvider(environment, await secret(environment)),
  };
}
export function paymentCallbackUrl() {
  let url: URL;
  try {
    url = new URL(process.env.THROTTLEHUB_APP_URL || "http://localhost:3000");
  } catch {
    throw new PaymentError("Application URL is not configured.", 503);
  }
  if (
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    throw new PaymentError("Invalid application URL.", 503);
  return `${url.origin}/account/promotions`;
}
