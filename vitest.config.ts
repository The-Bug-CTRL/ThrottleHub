import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    fileParallelism: false,
    exclude: [
      "node_modules/**",
      ".tools/**",
      ".next/**",
      ...(process.env.RUN_FIREBASE_TESTS === "true"
        ? []
        : [
            "tests/rules.test.ts",
            "tests/security-audit.test.ts",
            "tests/seller-video.test.ts",
            "tests/photo-security.test.ts",
            "tests/listing-engagement.test.ts",
            "tests/normal-registration.test.ts",
            "tests/content-profile-integration.test.ts",
            "tests/imported-video-integration.test.ts",
            "tests/workflows.test.ts",
            "tests/listing-history-integration.test.ts",
          ]),
    ],
  },
});
