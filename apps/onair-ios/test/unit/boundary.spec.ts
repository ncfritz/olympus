import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";

/**
 * The modules the unit tests reach must import nothing but each other.
 *
 * The same guard as `tools/auth-tester-mobile`: React Native's sources are
 * Flow-typed and the test runner cannot parse them, so a spec that reached
 * them would die on `Parse failure: Flow is not supported` rather than on
 * anything to do with the code (`docs/conventions/mobile.md`).
 */
const PURE = [
  "auth/failure.ts",
  "auth/keys.ts",
  "config.ts",
  "schedule.ts",
  "theme.ts",
];

/** Workspace packages built to run anywhere, so importing one keeps a module pure. */
const SHARED = ["@ncfritz/olympus-auth-flow", "@ncfritz/olympus-availability"];

const source = (file: string): string =>
  fs.readFileSync(path.join(__dirname, "../../src", file), "utf8");

/** Every module a file names, by its `from` clause or a bare import. */
const importsOf = (file: string): string[] => [
  ...[...source(file).matchAll(/\bfrom\s*["']([^"']+)["']/g)].map(
    (match) => match[1]!,
  ),
  ...[...source(file).matchAll(/^\s*import\s+["']([^"']+)["']/gm)].map(
    (match) => match[1]!,
  ),
];

/** Everything reached from a module that is not one of ours, followed through relative imports. */
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
    expect(reached(file).filter((from) => !SHARED.includes(from))).toEqual([]);
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
