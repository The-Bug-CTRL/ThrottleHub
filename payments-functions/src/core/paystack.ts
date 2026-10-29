import { createHash } from "node:crypto";
import {
  PaymentError,
  assertLiveEnabled,
  type PaymentEnvironment,
} from "./catalogue.js";
export type VerifiedPayment = {
  reference: string;
  id: string;
  domain: string;
  status: string;
  amount: number;
  currency: string;
  payerHash: string;
  paidAt: string | null;
};
export interface PaymentProvider {
  initialize(input: {
    reference: string;
    email: string;
    amount: number;
    callbackUrl: string;
  }): Promise<{ url: string }>;
  verify(reference: string): Promise<VerifiedPayment>;
  transactionReference(id: string): Promise<string>;
}
export const emailHash = (email: string) =>
  createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
export function checkoutUrl(value: unknown) {
  try {
    const url = new URL(String(value));
    if (
      url.protocol === "https:" &&
      url.hostname === "checkout.paystack.com" &&
      !url.port &&
      !url.username &&
      !url.password &&
      /^\/[a-zA-Z0-9_-]+$/.test(url.pathname)
    )
      return url.href;
  } catch {}
  throw new PaymentError(
    "Payment provider returned an invalid checkout address.",
    502,
  );
}
export class PaystackProvider implements PaymentProvider {
  constructor(
    private environment: PaymentEnvironment,
    private secret: string,
  ) {
    assertLiveEnabled(environment);
    if (
      !secret.startsWith(environment === "test" ? "sk_test_" : "sk_live_") ||
      secret.length < 16
    )
      throw new PaymentError(
        "Paystack credentials are not configured for this environment.",
        503,
      );
  }
  private async request(path: string, input?: unknown) {
    let response: Response;
    try {
      response = await fetch(`https://api.paystack.co${path}`, {
        method: input ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${this.secret}`,
          "Content-Type": "application/json",
        },
        ...(input ? { body: JSON.stringify(input) } : {}),
        signal: AbortSignal.timeout(15000),
        cache: "no-store",
      });
    } catch {
      throw new PaymentError(
        "Paystack is temporarily unavailable. Retry verification shortly.",
        503,
      );
    }
    if (!response.ok)
      throw new PaymentError(
        "Paystack could not complete this request. Retry shortly.",
        502,
      );
    const result = await response.json();
    if (result.status !== true || !result.data)
      throw new PaymentError("Paystack did not confirm this request.", 502);
    return result.data;
  }
  async initialize(input: {
    reference: string;
    email: string;
    amount: number;
    callbackUrl: string;
  }) {
    const data = await this.request("/transaction/initialize", {
      reference: input.reference,
      email: input.email,
      amount: input.amount,
      currency: "ZAR",
      callback_url: input.callbackUrl,
      channels: ["card"],
    });
    if (data.reference !== input.reference)
      throw new PaymentError("Payment reference mismatch.", 502);
    return { url: checkoutUrl(data.authorization_url) };
  }
  async verify(reference: string): Promise<VerifiedPayment> {
    const data = await this.request(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );
    return {
      reference: String(data.reference || ""),
      id: String(data.id || ""),
      domain: String(data.domain || ""),
      status: String(data.status || ""),
      amount: data.amount,
      currency: String(data.currency || ""),
      payerHash: emailHash(String(data.customer?.email || "")),
      paidAt: typeof data.paid_at === "string" ? data.paid_at : null,
    };
  }
  async transactionReference(id: string) {
    if (!/^\d{1,30}$/.test(id))
      throw new PaymentError("Invalid transaction identifier.");
    return String((await this.request(`/transaction/${id}`)).reference || "");
  }
}
