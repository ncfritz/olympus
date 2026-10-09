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
 * Native to test the parts of this app that are just code.
 */
const PURE = [
  "called.ts",
  "endpoints.ts",
  "keys.ts",
  "mutualTls.ts",
  "session.ts",
];

const source = (file: string): string =>
  fs.readFileSync(path.join(__dirname, "../../src", file), "utf8");

/**
 * Every module a file names. By the `from` clause rather than by the statement:
 * an import can be spread over as many lines as prettier likes, and a pattern
 * that allows for that is a pattern that can run past the end of a statement.
 */
const importsOf = (file: string): string[] => [
  ...[...source(file).matchAll(/\bfrom\s*["']([^"']+)["']/g)].map(
    (match) => match[1]!,
  ),
  ...[...source(file).matchAll(/^\s*import\s+["']([^"']+)["']/gm)].map(
    (match) => match[1]!,
  ),
];

/**
 * Everything reached from a module that is not a module of its own, following
 * relative imports as far as they go: a pure module that imports a file that
 * imports React Native is not pure, and the failure would look like the same
 * parse error rather than like this.
 */
const reached = (file: string): string[] => {
  const seen = new Set<string>();
  const outside: string[] = [];
  const walk = (name: string) => {
    if (seen.has(name)) return;
    seen.add(name);
    for (const from of importsOf(name)) {
      if (from.startsWith(".")) walk(`${from.replace(/^\.\//, "")}.ts`);
      else outside.push(from);
    }
  };
  walk(file);
  return outside;
};

describe("the unit-tested modules", () => {
  it.each(PURE)("%s imports nothing off the device", (file: string) => {
    // The shared flow package is platform-free by construction -- it is tested
    // with no ambient types at all -- so importing it keeps a module pure.
    expect(
      reached(file).filter(
        (from) =>
          !from.startsWith(".") && from !== "@ncfritz/olympus-auth-flow",
      ),
    ).toEqual([]);
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
