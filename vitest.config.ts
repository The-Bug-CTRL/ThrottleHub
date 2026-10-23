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
            "tests/workflows.test.ts",
            "tests/listing-history-integration.test.ts",
          ]),
    ],
  },
});
