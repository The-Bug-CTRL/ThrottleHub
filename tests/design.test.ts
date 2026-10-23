import { describe, it, expect } from "vitest";
import { designTokens } from "../src/lib/design-tokens";
function luminance(hex: string) {
  const rgb = hex
    .replace("#", "")
    .match(/.{2}/g)!
    .map((v) => parseInt(v, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
function contrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
describe("Dirt & Stone accessible color pairs", () => {
  const c = designTokens.colors;
  for (const [name, a, b] of [
    ["primary button", c.white, c.brand],
    ["body", c.charcoal, c.background],
    ["muted metadata", c.muted, c.background],
    ["stone panel metadata", c.muted, c.stone],
    ["brand links", c.brand, c.background],
    ["white header", c.white, c.charcoal],
  ])
    it(`${name} meets WCAG AA normal-text contrast`, () => {
      expect(contrast(a, b)).toBeGreaterThanOrEqual(4.5);
    });
});
