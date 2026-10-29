import { FlatCompat } from "@eslint/eslintrc";
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { ignores: [".next/**", ".tools/**", "node_modules/**", "**/node_modules/**", "payments-functions/lib/**", "next-env.d.ts"] },
];
export default config;
