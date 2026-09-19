// Vitest preset for plain TypeScript packages.
import { defineConfig } from "vitest/config";
import { coverage } from "./coverage.js";

export default defineConfig({
  test: {
    // Tests live under test/ (unit tests in test/unit, mirroring src).
    include: ["test/**/*.spec.ts"],
    environment: "node",
    coverage,
  },
});
