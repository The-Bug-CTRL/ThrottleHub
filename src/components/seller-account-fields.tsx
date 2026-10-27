"use client";
import {
  businessCategories,
  emptyBusiness,
  type AccountType,
} from "@/lib/seller-account";
export function AccountTypePicker({
  value,
  onChange,
}: {
  value: AccountType | "";
  onChange: (value: AccountType) => void;
}) {
  return (
    <fieldset className="seller-account-picker">
      <legend>Choose your seller account</legend>
      <div className="seller-account-options">
        {(
          [
            [
              "personal",
              "Personal account",
              "For your own bikes, parts and riding kit.",
            ],
            [
              "business",
              "Business account",
              "For dealerships, shops, workshops and traders.",
            ],
          ] as const
        ).map(([type, title, description]) => (
          <label key={type} className={value === type ? "selected" : ""}>
            <input
              type="radio"
              name="accountType"
              value={type}
              checked={value === type}
              onChange={() => onChange(type)}
            />
            <strong>{title}</strong>
            <span>{description}</span>
          </label>
        ))}
      </div>
      <small>
        Business Seller is self-declared. It does not grant verification or
        admin access.
      </small>
    </fieldset>
  );
}
export function BusinessProfileFields({
  value,
  onChange,
}: {
  value: typeof emptyBusiness;
  onChange: (value: typeof emptyBusiness) => void;
}) {
  return (
    <fieldset className="business-profile-fields">
      <legend>Your public business</legend>
      <p>
        These details are public. Leave contact fields empty if you do not want
        to share them.
      </p>
      {(
        [
          "name",
          "logoURL",
          "description",
          "website",
          "phone",
          "email",
          "hours",
        ] as const
      ).map((key) => (
        <label key={key}>
          {
            {
              name: "Business name",
              logoURL: "Business logo URL (HTTPS)",
              description: "Business description",
              website: "Website (HTTPS)",
              phone: "Public business telephone (optional)",
              email: "Public business email (optional)",
              hours: "Operating hours (optional)",
            }[key]
          }
          {key === "description" || key === "hours" ? (
            <textarea
              value={value[key]}
              maxLength={key === "description" ? 2000 : 500}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            />
          ) : (
            <input
              required={key === "name"}
              type={
                key === "email"
                  ? "email"
                  : key === "website" || key === "logoURL"
                    ? "url"
                    : "text"
              }
              value={value[key]}
              maxLength={
                key === "name"
                  ? 120
                  : key === "logoURL"
                    ? 2048
                    : key === "phone"
                      ? 40
                      : 500
              }
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            />
          )}
        </label>
      ))}
      <label>
        Business type
        <select
          value={value.category}
          onChange={(e) =>
            onChange({
              ...value,
              category: e.target.value as typeof emptyBusiness.category,
            })
          }
        >
          {businessCategories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}
