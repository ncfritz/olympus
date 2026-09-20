import react from "@ncfritz/olympus-config/eslint/react";
import nextVitals from "eslint-config-next/core-web-vitals";
import { defineConfig, globalIgnores } from "eslint/config";

// Next's rules (React, hooks, Next) plus the workspace React config
// (TypeScript, Prettier, the inline-style ratchet of docs/conventions/ux.md).
export default defineConfig([
  ...nextVitals,
  ...react,
  {
    // eslint-plugin-react's version detection calls an API ESLint 10
    // removed; naming the version skips it.
    settings: { react: { version: "19.2" } },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated from the agent's OpenAPI document (pnpm generate:api).
    "src/lib/api/schema.d.ts",
  ]),
]);
