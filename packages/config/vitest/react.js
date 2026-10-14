// Vitest preset for React packages: jsdom, and .tsx tests.
//
// Globals are off across the workspace, so Testing Library's automatic
// cleanup does not register itself. A package using this preset adds a
// `test/setup.ts` that calls `cleanup` after each test:
//
//   import { cleanup } from "@testing-library/react";
//   import { afterEach } from "vitest";
//   afterEach(cleanup);
import { defineConfig } from "vitest/config";
import { coverage } from "./coverage.js";

export default defineConfig({
  test: {
    // Tests live under test/ (unit tests in test/unit, mirroring src).
    include: ["test/**/*.spec.{ts,tsx}"],
    environment: "jsdom",
    // From Node 25, Node has its own localStorage, undefined without
    // --localstorage-file, and it hides jsdom's: window.localStorage is
    // then undefined in a test. Off, jsdom's storage is the one used.
    execArgv: ["--no-experimental-webstorage"],
    setupFiles: ["test/setup.ts"],
    coverage,
  },
});
