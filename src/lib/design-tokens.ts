// Keep these values aligned with globals.css. Suitable for a future Flutter Theme.
export const designTokens = {
  colors: {
    brand: "#78543D",
    charcoal: "#272725",
    background: "#FAF9F6",
    stone: "#F3EEE6",
    white: "#FFFFFF",
    muted: "#6F6860",
    border: "#DED9D2",
    success: "#35614A",
    error: "#A33632",
    warning: "#895E20",
  },
  font: { family: "Manrope", weights: [400, 500, 600, 700, 800] },
  radii: { control: 6, card: 10, panel: 12 },
  space: [4, 8, 12, 16, 24, 32, 48, 64],
  breakpoints: { mobile: 640, tablet: 900, desktop: 1200, wide: 1600 },
} as const;
