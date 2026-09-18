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
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
