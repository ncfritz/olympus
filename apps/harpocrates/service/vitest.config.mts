import nest from "@ncfritz/olympus-config/vitest/nest";
import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

// Two projects:
// - unit: test/unit, test/conventions and test/api (the app over HTTP with
//   no database or signer: auth, health, the document). `pnpm test`.
// - e2e: test/e2e, the app against a real Postgres and a real signer
//   (spawned from ../signer with uv). Opt-in: `pnpm test:e2e`, with
//   HARPOCRATES_E2E_DATABASE_URL naming a database it may create schemas in.
export default mergeConfig(
  nest,
  defineConfig({
    test: {
      setupFiles: ["test/support/setup.ts"],
      env: {
        // Nothing connects in the unit project: the database and the
        // signer are only reached on first use.
        DATABASE_URL:
          "postgresql://harpocrates:test@harpocrates.test:5432/test",
        SIGNER_SOCKET_PATH: "/nonexistent/signer.sock",
        SIGNER_TOKEN_FILE: "/nonexistent/token",
        AUTH_JWKS_FILE: "test/fixtures/jwks.json",
        PKI_REALM: "ncfritz.net Test",
        PKI_DISTRIBUTION_URL: "http://pki.internal.localhost",
      },
      outputFile: { html: "test-report/index.html" },
      projects: [
        {
          extends: true,
          test: {
            name: "unit",
            include: [
              "test/unit/**/*.spec.ts",
              "test/conventions/**/*.spec.ts",
              "test/api/**/*.spec.ts",
            ],
            // The preset's test/** include merges in: exclude the other project.
            exclude: [...configDefaults.exclude, "test/e2e/**"],
          },
        },
        {
          extends: true,
          test: {
            name: "e2e",
            include: ["test/e2e/**/*.spec.ts"],
            exclude: [
              ...configDefaults.exclude,
              "test/unit/**",
              "test/conventions/**",
              "test/api/**",
            ],
            testTimeout: 60_000,
            hookTimeout: 120_000,
            // One signer and one schema per file, files one at a time.
            fileParallelism: false,
          },
        },
      ],
    },
  }),
);
