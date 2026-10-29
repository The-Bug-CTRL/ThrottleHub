export function publicPhone(
  profile:
    | {
        accountType?: unknown;
        sellerType?: unknown;
        business?: { phone?: unknown };
        contactPhone?: unknown;
        contactPhonePublic?: unknown;
        businessContactsPublic?: unknown;
      }
    | undefined,
) {
  const raw =
    profile?.accountType === "business" || profile?.sellerType === "dealer"
      ? (profile?.businessContactsPublic === true
          ? profile?.business?.phone
          : "") ||
        (profile?.contactPhonePublic === true ? profile?.contactPhone : "")
      : profile?.contactPhonePublic === true
        ? profile?.contactPhone
        : "";
  const value = typeof raw === "string" ? raw.replace(/[ ()-]/g, "") : "";
  return /^\+?[0-9]{7,15}$/.test(value) ? value : "";
}
