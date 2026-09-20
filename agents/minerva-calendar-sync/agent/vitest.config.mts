import nest from "@ncfritz/olympus-config/vitest/nest";
import { defineConfig, mergeConfig } from "vitest/config";

// Three projects:
// - unit:        test/unit, each file on its own temporary SQLite database
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
            include: ["test/unit/**/*.spec.ts"],
          },
        },
        {
          extends: true,
          test: {
            name: "e2e",
            include: ["test/e2e/**/*.e2e-spec.ts"],
            setupFiles: [
              "test/e2e/env-setup.ts",
              "test/e2e/reset-synced-calendars.ts",
            ],
          },
        },
        {
          extends: true,
          test: {
            name: "integration",
            include: ["test/integration/**/*.integration-spec.ts"],
            setupFiles: ["test/integration/env-setup.ts"],
          },
        },
      ],
    },
  }),
);
