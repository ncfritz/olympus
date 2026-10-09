import { defineConfig } from "vitest/config";

// Inline rather than `@ncfritz/olympus-config/vitest/node`: that package's
// dependencies are ESLint 10's plugins, and this app is deliberately still on
// ESLint 8 until the site's own conventions work. It moves onto the preset then.
//
// Only the modules with no React, no Next and no DOM in them are unit-tested
// here -- the session, the callback checks and the initials. Anything that needs
// a browser is a sign-off step in the plan, not a test.
export default defineConfig({
  test: {
    include: ["test/**/*.spec.ts"],
    environment: "node",
  },
});
