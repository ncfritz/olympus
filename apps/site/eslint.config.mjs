import globals from "globals";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    // Debt the site arrived with, not debt the import created: the same ESLint
    // on the pre-import repository reports the same 433 errors, and
    // `next.config.mjs` has been hiding them with
    // `eslint: { ignoreDuringBuilds: true }`.
    //
    // Warnings rather than errors, so `pnpm lint` is honest about the state of
    // the code without failing every build in the workspace over it. They are
    // counted in docs/roadmap.md and belong to the site's own conventions work,
    // which is also when `strict` goes on -- most of the 143 `any`s are where a
    // real type would have been inferred.
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "no-useless-catch": "warn",
      "no-empty-pattern": "warn",
      "no-empty": "warn",
    },
  },
  {
    files: [
      "**/*.js",
      "**/*.mjs",
      "**/*.cjs",
      "**/*.ts",
      "**/*.tsx",
      "**/*.json",
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
