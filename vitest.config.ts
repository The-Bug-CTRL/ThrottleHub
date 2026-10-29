import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    fileParallelism: false,
    exclude: [
      "node_modules/**",
      "payments-functions/node_modules/**",
      "payments-functions/lib/**",
      ".tools/**",
      ".next/**",
      ...(process.env.RUN_FIREBASE_TESTS === "true"
        ? []
        : [
            "tests/release-privacy.test.ts",
            "tests/forum-media.test.ts",
            "tests/support-integration.test.ts",
            "tests/rules.test.ts",
            "tests/security-audit.test.ts",
            "tests/seller-video.test.ts",
            "tests/photo-security.test.ts",
            "tests/listing-engagement.test.ts",
            "tests/normal-registration.test.ts",
            "tests/payment-integration.test.ts",
            "tests/content-profile-integration.test.ts",
            "tests/imported-video-integration.test.ts",
            "tests/workflows.test.ts",
            "tests/listing-history-integration.test.ts",
          ]),
    ],
  },
});
