import { motorcycleCatalogue } from "./marketplace";
import { categoryChildren } from "./taxonomy";
import { designTokens } from "./design-tokens";
const configuredOrigin =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const seoEnabled =
  /^https:\/\//.test(configuredOrigin) &&
  !/localhost|127\.0\.0\.1/.test(configuredOrigin);
export const brand = {
  name: "ThrottleHub",
  tagline: "Good bikes. Great stories. Your next ride.",
  supportEmail: "",
  domain: configuredOrigin.replace(/\/$/, ""),
  accent: designTokens.colors.brand,
  homeHeading: "Find your next ride.",
  homeDescription:
    "Off-road motorcycles, hard-to-find parts and riding gear. South Africa's marketplace built around the people who ride.",
  social: {},
  defaultCountry: "ZA",
  enabledCountries: ["ZA"],
  countries: { ZA: "South Africa" },
  currencies: ["ZAR"],
};
export const categories = Object.fromEntries(
  categoryChildren().map((c) => [
    c.name,
    categoryChildren(c.id).map((x) => x.name),
  ]),
);
export const makes = Object.keys(motorcycleCatalogue);
