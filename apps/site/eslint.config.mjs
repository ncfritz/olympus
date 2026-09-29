import globals from "globals";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default [
  {
    // Not the site's code. `public/` is the vendored TinyMCE the build copies
    // into it -- 2,315 files, mostly minified, against 372 in src/ -- and
    // `.next/` is build output. A config object with only `ignores` is how flat
    // config spells "globally", and without it a lint run takes minutes rather
    // than seconds and reports findings nobody can act on.
    //
    // apps/control does this with `globalIgnores` from `eslint/config`, which
    // needs ESLint 9 or later; this package is still on 8 until it can say
    // `catalog:` (docs/roadmap.md).
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "public/**",
      "next-env.d.ts",
    ],
  },
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
      // The shape the workspace uses (packages/config/eslint/react.js): a
      // leading underscore marks an intentionally unused name. Still a warning
      // rather than an error here, because 442 of them arrived with the site --
      // but what counts as fixed now matches what the shared config will accept
      // when this package can use it.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
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
