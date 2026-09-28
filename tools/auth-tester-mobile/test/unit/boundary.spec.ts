import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";

/**
 * The modules the unit tests reach must import nothing but each other.
 *
 * This is here because the alternative failed: `storage.ts` imports
 * `expo-secure-store`, which imports React Native, whose sources are
 * Flow-typed -- and the test runner cannot parse them, so a spec that touched
 * it died on `Parse failure: Flow is not supported` rather than on anything to
 * do with the code. Keeping the boundary is cheaper than transforming React
 * Native to test two pure functions.
 */
const PURE = ["endpoints.ts", "keys.ts"];

const imports = (file: string): string[] =>
  [
    ...fs
      .readFileSync(path.join(__dirname, "../../src", file), "utf8")
      .matchAll(/^\s*import\s[^"']*["']([^"']+)["']/gm),
  ].map((match) => match[1]!);

describe("the unit-tested modules", () => {
  it.each(PURE)("%s imports nothing off the device", (file: string) => {
    expect(imports(file).filter((from) => !from.startsWith("."))).toEqual([]);
  });

  it("covers every module the specs import", () => {
    const tested = fs
      .readdirSync(__dirname)
      .filter((name) => name.endsWith(".spec.ts"))
      .flatMap((name) => [
        ...fs
          .readFileSync(path.join(__dirname, name), "utf8")
          .matchAll(/["']\.\.\/\.\.\/src\/([^"']+)["']/g),
      ])
      .map((match) => `${match[1]!}.ts`);
    expect([...new Set(tested)].sort()).toEqual([...PURE].sort());
  });
});
