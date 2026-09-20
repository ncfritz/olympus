import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";

/**
 * The agent conventions (docs/conventions/agent.md) and the API layout
 * rules (docs/conventions/api.md) as checks over the source files.
 */
const ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(ROOT, "src");

const files = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return files(full);
    return [path.relative(SRC, full).split(path.sep).join("/")];
  });

const dirs = (dir: string): string[] =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return [full, ...dirs(full)];
    });

const SOURCES = files(SRC).filter((file) => file.endsWith(".ts"));
const read = (file: string) => fs.readFileSync(path.join(SRC, file), "utf8");

/** Files that may read process.env: config loading and bootstrap only. */
const ENV_READERS = new Set([
  "config/configuration.ts", // the typed namespaces
  "main.ts", // validates the configuration before Nest starts
  "AppModule.ts", // OutboxModule.register(OUTBOX_ENABLED)
  "openapiEnv.ts", // placeholders for OpenAPI generation
  "openapi/documentBuilder.ts", // npm_package_version for info.version
]);

/** The OpenAPI generator is a command-line tool. */
const CONSOLE_WRITERS = new Set(["openapi.ts"]);

/**
 * The folder a class's file lives in, by the suffix of the class name.
 * (Lower-case files hold the interfaces and helpers beside them.)
 */
const FOLDERS: [RegExp, string][] = [
  [/^[A-Z]\w*Controller$/, "controllers"],
  [/^[A-Z]\w*(Service|Registry|Engine|Notifier)$/, "services"],
  [/^[A-Z]\w*Converter$/, "converters"],
  [/^[A-Z]\w*Strategy$/, "strategies"],
  [/^[A-Z]\w*Guard$/, "guards"],
];

/** Exceptions to FOLDERS. */
const PLACED = new Set([
  "AppController.ts", // Nest's scaffolding root route, outside the API document
  "AppService.ts",
  "store/prisma/PrismaService.ts", // the database client, beside the Prisma stores
]);

describe("agent conventions", () => {
  it("keeps tests out of src", () => {
    expect(SOURCES.filter((f) => /\.(spec|test)\.ts$/.test(f))).toEqual([]);
  });

  it("mirrors src in test/unit", () => {
    const unit = path.join(ROOT, "test/unit");
    const strays = dirs(unit)
      .map((dir) => path.relative(unit, dir).split(path.sep).join("/"))
      .filter((dir) => !fs.existsSync(path.join(SRC, dir)));
    expect(strays).toEqual([]);
  });

  it("names a file after the class it exports", () => {
    const mismatched = SOURCES.flatMap((file) => {
      const classes = [
        ...read(file).matchAll(/^export (?:abstract )?class (\w+)/gm),
      ].map((m) => m[1]);
      return classes.length === 1 && classes[0] !== path.basename(file, ".ts")
        ? [`${file}: class ${classes[0]}`]
        : [];
    });
    expect(mismatched).toEqual([]);
  });

  it("keeps each kind of class in its folder", () => {
    const misplaced = SOURCES.filter((file) => {
      if (PLACED.has(file)) return false;
      const name = path.basename(file, ".ts");
      const folder = path.basename(path.dirname(file));
      return FOLDERS.some(
        ([pattern, expected]) => pattern.test(name) && folder !== expected,
      );
    });
    expect(misplaced).toEqual([]);
  });

  it("publishes only from the outbox dispatcher", () => {
    expect(
      SOURCES.filter(
        (file) =>
          file !== "outbox/services/OutboxDispatcherService.ts" &&
          /\.publish\(/.test(read(file)),
      ),
    ).toEqual([]);
  });

  it("reads process.env only through src/config", () => {
    expect(
      SOURCES.filter(
        (file) => !ENV_READERS.has(file) && /\bprocess\.env\b/.test(read(file)),
      ),
    ).toEqual([]);
  });

  it("logs through Nest's Logger, not the console", () => {
    expect(
      SOURCES.filter(
        (file) =>
          !CONSOLE_WRITERS.has(file) &&
          /\bconsole\.(log|info|warn|error|debug)\(/.test(read(file)),
      ),
    ).toEqual([]);
  });

  it("keeps request and response shapes in src/model", () => {
    // @ApiProperty outside src/model means a shape the conventions
    // tests do not see (the old dto/ folders).
    expect(
      SOURCES.filter(
        (file) =>
          !file.startsWith("model/") &&
          !file.startsWith("openapi/") &&
          /@ApiProperty\(/.test(read(file)),
      ),
    ).toEqual([]);
  });
});
