import nest from "@ncfritz/olympus-config/vitest/nest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  nest,
  defineConfig({
    test: {
      setupFiles: ["test/support/setup.ts"],
      env: {
        // Never the developer's database: nothing connects until a
        // repository is first used, and phase 0 has none.
        DATABASE_URL:
          "postgresql://harpocrates:test@harpocrates.test:5432/test",
      },
      outputFile: { html: "test-report/index.html" },
    },
  }),
);
