import nest from "@ncfritz/olympus-config/vitest/nest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  nest,
  defineConfig({
    test: {
      setupFiles: ["test/support/setup.ts"],
    },
  }),
);
