// Vitest preset for plain TypeScript packages.
import { defineConfig } from "vitest/config";
import { coverage } from "./coverage.js";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts", "test/**/*.spec.ts"],
    environment: "node",
    coverage,
  },
});
