import globals from "globals";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
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
