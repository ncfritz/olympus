// Shared Vitest coverage settings. Every package writes its report to
// ./coverage: open coverage/index.html for the HTML report.
// The package must list "@vitest/coverage-v8" in devDependencies.

/** @type {import("vitest/node").CoverageOptions} */
export const coverage = {
  provider: "v8",
  reporter: ["text-summary", "html", "lcov", "json-summary"],
  reportsDirectory: "coverage",
  // Write the report even when a test fails, so failures and coverage can
  // be looked at together.
  reportOnFailure: true,
  include: ["src/**/*.{ts,tsx}"],
  exclude: [
    "src/generated/**",
    "src/**/*.spec.{ts,tsx}",
    "src/**/index.ts",
    "src/main.ts",
  ],
};
