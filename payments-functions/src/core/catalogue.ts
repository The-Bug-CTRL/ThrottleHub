export type PaymentEnvironment = "test" | "live";
export class PaymentError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
// All prices are integer ZAR cents, never supplied by a purchaser.
export const PRODUCTS = {
  bump: {
    sku: "bump",
    name: "Bump to Top",
    amount: 1900,
    durationDays: 0,
    enabled: true,
  },
  featured7: {
    sku: "featured7",
    name: "Featured for 7 Days",
    amount: 4900,
    durationDays: 7,
    enabled: true,
  },
  featured30: {
    sku: "featured30",
    name: "Featured for 30 Days",
    amount: 12900,
    durationDays: 30,
    enabled: true,
  },
} as const;
export type Product = (typeof PRODUCTS)[keyof typeof PRODUCTS];
export function product(sku: unknown): Product {
  if (typeof sku !== "string" || !Object.hasOwn(PRODUCTS, sku))
    throw new PaymentError("Choose a promotion product.");
  const selected = PRODUCTS[sku as keyof typeof PRODUCTS];
  if (!selected.enabled)
    throw new PaymentError("This promotion is not available.");
  if (!Number.isSafeInteger(selected.amount) || selected.amount <= 0)
    throw new PaymentError("Invalid promotion price.", 503);
  return selected;
}
export function centsToRand(cents: number) {
  if (!Number.isSafeInteger(cents) || cents < 0)
    throw new PaymentError("Invalid amount.");
  return `R${(cents / 100).toFixed(2)}`;
}
export function bumpCooldownMs() {
  const hours = Number(process.env.THROTTLEHUB_BUMP_COOLDOWN_HOURS || 48);
  if (!Number.isFinite(hours) || hours < 1 || hours > 720)
    throw new PaymentError("Invalid bump cooldown configuration.", 503);
  return hours * 3600000;
}
export function assertLiveEnabled(environment: PaymentEnvironment) {
  if (
    environment === "live" &&
    process.env.THROTTLEHUB_ENABLE_LIVE_PAYMENTS !== "approved"
  )
    throw new PaymentError("Live payments are disabled.", 503);
}
export function collectionName(kind: string, environment: PaymentEnvironment) {
  return `${kind}${environment === "test" ? "Test" : "Live"}`;
}
export const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
export function validReference(
  value: unknown,
  environment: PaymentEnvironment,
): value is string {
  return (
    typeof value === "string" &&
    new RegExp(`^th-${environment}-[a-f0-9]{48}$`).test(value)
  );
}
