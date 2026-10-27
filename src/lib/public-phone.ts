export function publicPhone(
  profile:
    | {
        accountType?: unknown;
        sellerType?: unknown;
        business?: { phone?: unknown };
        contactPhone?: unknown;
      }
    | undefined,
) {
  const raw =
    profile?.accountType === "business" || profile?.sellerType === "dealer"
      ? profile?.business?.phone || profile?.contactPhone
      : profile?.contactPhone;
  const value = typeof raw === "string" ? raw.replace(/[ ()-]/g, "") : "";
  return /^\+?[0-9]{7,15}$/.test(value) ? value : "";
}
