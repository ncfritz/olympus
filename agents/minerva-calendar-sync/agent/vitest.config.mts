import nest from "@ncfritz/olympus-config/vitest/nest";
import { defineConfig, mergeConfig } from "vitest/config";

// Three projects:
// - unit:        test/unit, each file on its own temporary SQLite database,
//                and the convention checks in test/conventions
// - e2e:         test/e2e, the whole app over HTTP (supertest) on SQLite
// - integration: test/integration, against the Postgres of docker-compose.yml
//                (opt-in: pnpm test:integration)
export default mergeConfig(
  nest,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: "unit",
            include: [
              "test/unit/**/*.spec.ts",
              "test/conventions/**/*.spec.ts",
            ],
            setupFiles: ["test/support/setup.ts"],
          },
        },
        {
          extends: true,
          test: {
            name: "e2e",
            include: ["test/e2e/**/*.e2e-spec.ts"],
            setupFiles: [
              "test/support/setup.ts",
              "test/e2e/env-setup.ts",
              "test/e2e/reset-state.ts",
            ],
          },
        },
        {
          extends: true,
          test: {
            name: "integration",
            include: ["test/integration/**/*.integration-spec.ts"],
            setupFiles: [
              "test/support/setup.ts",
              "test/integration/env-setup.ts",
            ],
          },
        },
      ],
    },
  }),
);
