import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";

/**
 * Tests live in test/ (unit tests in test/unit, mirroring src). Vitest only
 * collects test/**, so a spec left in src would silently never run.
 */
const SRC = path.resolve(__dirname, "../../src");

const specsUnder = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return specsUnder(full);
    return /\.(spec|test)\.tsx?$/.test(entry.name)
      ? [path.relative(SRC, full)]
      : [];
  });

/** Files that may read process.env: config loading and bootstrap only. */
const ENV_READERS = new Set([
  "config/configuration.ts", // the typed namespaces
  "main.ts", // validates the configuration before Nest starts
  "authUser.ts", // the auth:user CLI, which reads the same env file
  "AppModule.ts", // envFilePath from NODE_ENV
  "openapiEnv.ts", // placeholders for OpenAPI generation
  "schema/documentBuilder.ts", // npm_package_version for info.version
]);

const sourcesUnder = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourcesUnder(full);
    return entry.name.endsWith(".ts") ? [path.relative(SRC, full)] : [];
  });

describe("API source layout", () => {
  it("reads process.env only through src/config", () => {
    const readers = sourcesUnder(SRC).filter(
      (file) =>
        !ENV_READERS.has(file.split(path.sep).join("/")) &&
        /\bprocess\.env\b/.test(fs.readFileSync(path.join(SRC, file), "utf8")),
    );
    expect(readers).toEqual([]);
  });

  it("keeps tests out of src", () => {
    expect(specsUnder(SRC)).toEqual([]);
  });
});
