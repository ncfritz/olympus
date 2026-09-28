// Shared flat config for React Native / Expo packages (tools/auth-tester-mobile).
//
// Deliberately not `eslint-config-expo`. Its bundled `eslint-plugin-react`
// fails on this workspace's ESLint 10 -- `contextOrFilename.getFilename is not
// a function`, the removed legacy rule context -- despite the config's
// `eslint: ">=8.10"` peer range, so using it would mean pinning a second ESLint
// major for one package. This is the repo's own shape instead, plus the hooks
// rules, which are the ones React Native code actually needs.
import eslint from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  { ignores: [".expo/**", "dist/**", "coverage/**", "web-build/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  // The flat variants live under `configs.flat`; `configs.recommended` at the
  // top level is still the eslintrc shape and is rejected outright.
  reactHooks.configs.flat["recommended-latest"],
  eslintPluginPrettierRecommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      // React Native is not a browser -- there is no `window` -- but its
      // globals are close enough to browser ones for linting, and this is what
      // Expo's own config does. `__DEV__` is React Native's.
      globals: { ...globals.browser, __DEV__: "readonly" },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // A leading underscore marks an intentionally unused name.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["**/*.tsx"],
    rules: {
      // The same ratchet as the site's (docs/conventions/ux.md): a style object
      // in the markup rather than in StyleSheet.create.
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            "JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression",
          message:
            "Avoid inline style objects. Use StyleSheet.create (docs/conventions/ux.md).",
        },
      ],
    },
  },
];
