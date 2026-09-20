import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";

/**
 * The agent conventions (docs/conventions/agent.md) as checks over the
 * source files.
 */
const SRC = path.resolve(__dirname, "../../src");

const files = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return files(full);
    return [path.relative(SRC, full).split(path.sep).join("/")];
  });

const SOURCES = files(SRC);
const read = (file: string) => fs.readFileSync(path.join(SRC, file), "utf8");

/** Files that may read process.env: config loading and bootstrap only. */
const ENV_READERS = new Set([
  "config/configuration.ts",
  "main.ts",
  "AppModule.ts",
]);

describe("agent conventions", () => {
  it("keeps tests out of src", () => {
    expect(SOURCES.filter((f) => /\.(spec|test)\.ts$/.test(f))).toEqual([]);
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

  it("keeps handlers in handlers/ and formatters in formatters/", () => {
    const misplaced = SOURCES.filter((file) => {
      const name = path.basename(file, ".ts");
      const folder = path.basename(path.dirname(file));
      return (
        (/Handler$/.test(name) &&
          folder !== "handlers" &&
          file !== "delivery/DeliveryHandler.ts") ||
        (/Formatters?$/.test(name) &&
          folder !== "formatters" &&
          file !== "delivery/NotificationFormatter.ts")
      );
    });
    expect(misplaced).toEqual([]);
  });

  it("subscribes with the messaging constants, not string literals", () => {
    const literal = SOURCES.filter((file) =>
      [...read(file).matchAll(/@RabbitSubscribe\(\{([\s\S]*?)\}\)/g)].some(
        ([, body]) => /["'`]/.test(body),
      ),
    );
    expect(literal).toEqual([]);
  });

  it("reads process.env only through src/config", () => {
    expect(
      SOURCES.filter(
        (file) => !ENV_READERS.has(file) && /\bprocess\.env\b/.test(read(file)),
      ),
    ).toEqual([]);
  });

  it("reaches the Olympus API only through @ncfritz/olympus-client", () => {
    // The wrappers call the SDK; here the SDK is used for its types only.
    const sdkCalls = SOURCES.filter((file) =>
      /^import (?!type )[^;]*from "@ncfritz\/olympus-sdk/m.test(read(file)),
    );
    // No hand-built API URLs either.
    const apiUrls = SOURCES.filter((file) => /\/v1\//.test(read(file)));
    expect({ sdkCalls, apiUrls }).toEqual({ sdkCalls: [], apiUrls: [] });
  });

  it("logs through Nest's Logger, not the console", () => {
    expect(
      SOURCES.filter((file) =>
        /\bconsole\.(log|info|warn|error|debug)\(/.test(read(file)),
      ),
    ).toEqual([]);
  });
});
