// Shared flat config for React / Next.js packages (site, ui, theme).
// Adds browser globals and the inline-style ratchet described in
// docs/conventions/ux.md. The style rule starts as "warn" so existing code
// builds; new packages (ui, theme) should override it to "error".
import eslint from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "dist/**",
      ".next/**",
      "out/**",
      "coverage/**",
      "src/generated/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
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
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            "JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression",
          message:
            "Avoid inline style objects. Use theme tokens or a styles hook (docs/conventions/ux.md).",
        },
      ],
    },
  },
];
