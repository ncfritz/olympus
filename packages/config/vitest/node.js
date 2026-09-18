// Vitest preset for plain TypeScript packages.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts", "test/**/*.spec.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/generated/**", "src/**/*.spec.ts"],
    },
  },
});
