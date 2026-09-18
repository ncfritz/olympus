import nest from "@ncfritz/olympus-config/vitest/nest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  nest,
  defineConfig({
    test: {
      // Controller modules log through Winston on import; keep test output
      // readable.
      env: { CONSOLE_LOGGING_LEVEL: "error" },
      outputFile: { html: "test-report/index.html" },
    },
  }),
);
