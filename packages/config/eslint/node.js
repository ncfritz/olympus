// Shared flat config for Node / NestJS packages (API, agents, model, SDK).
// Mirrors the config the existing repos already use: eslint recommended,
// typescript-eslint recommended, prettier as a lint rule.
import eslint from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["dist/**", "coverage/**", "src/generated/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    rules: {
      // A leading underscore marks an intentionally unused name
      // (interface-mandated parameters, bound-but-unused decorators).
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
