import { it, expect, vi, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import {
  PRODUCTS,
  product,
  centsToRand,
  assertLiveEnabled,
} from "../payments-functions/src/core/catalogue";
import {
  PaystackProvider,
  checkoutUrl,
} from "../payments-functions/src/core/paystack";
import { verifyWebhookSignature } from "../payments-functions/src/core/webhooks";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("controls exact integer ZAR prices and live access on the server", () => {
  expect([
    product("bump").amount,
    product("featured7").amount,
    product("featured30").amount,
  ]).toEqual([1900, 4900, 12900]);
  expect(centsToRand(1900)).toBe("R19.00");
  expect(() => centsToRand(19.5)).toThrow();
  expect(() => product("browser-price-1")).toThrow();
  const p = PRODUCTS.featured7 as { enabled: boolean };
  p.enabled = false;
  try {
    expect(() => product("featured7")).toThrow();
  } finally {
    p.enabled = true;
  }
  vi.stubEnv("THROTTLEHUB_ENABLE_LIVE_PAYMENTS", "disabled");
  expect(() => assertLiveEnabled("live")).toThrow();
  expect(
    () => new PaystackProvider("test", "sk_live_not_allowed_here"),
  ).toThrow();
});
it("validates raw-body HMAC in constant time and rejects forged/reformatted/oversized deliveries", () => {
  const secret = "sk_test_unit_test_key_only",
    raw = Buffer.from('{"event":"charge.success","data":{"reference":"x"}}'),
    signature = createHmac("sha512", secret).update(raw).digest("hex");
  expect(() => verifyWebhookSignature(raw, signature, secret)).not.toThrow();
  for (const supplied of ["bad", "0".repeat(128), undefined])
    expect(() => verifyWebhookSignature(raw, supplied, secret)).toThrow();
  expect(() =>
    verifyWebhookSignature(
      Buffer.concat([raw, Buffer.from(" ")]),
      signature,
      secret,
    ),
  ).toThrow();
  expect(() =>
    verifyWebhookSignature(Buffer.alloc(131073), signature, secret),
  ).toThrow();
});
it("uses official Initialize/Verify APIs and returns no card or authorization payload", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: true,
          data: {
            reference: "ref",
            authorization_url: "https://checkout.paystack.com/test_code",
          },
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: true,
          data: {
            reference: "ref",
            id: 123,
            domain: "test",
            status: "success",
            amount: 1900,
            currency: "ZAR",
            customer: { email: "seller@example.test" },
            authorization: { card_type: "never return me" },
          },
        }),
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  const provider = new PaystackProvider("test", "sk_test_unit_test_key_only");
  expect(
    await provider.initialize({
      reference: "ref",
      amount: 1900,
      email: "seller@example.test",
      callbackUrl: "http://localhost:3000/account/promotions",
    }),
  ).toEqual({ url: "https://checkout.paystack.com/test_code" });
  const input = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(input.amount).toBe(1900);
  expect(input.currency).toBe("ZAR");
  expect(fetcher.mock.calls[0][0]).toBe(
    "https://api.paystack.co/transaction/initialize",
  );
  const verified = await provider.verify("ref");
  expect(verified.domain).toBe("test");
  expect(JSON.stringify(verified)).not.toContain("never return me");
  expect(JSON.stringify(verified)).not.toContain("seller@example.test");
  expect(() =>
    checkoutUrl("https://checkout.paystack.com.evil.test/code"),
  ).toThrow();
  expect(() => checkoutUrl("javascript:alert(1)")).toThrow();
});
