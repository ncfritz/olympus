import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";

/**
 * A named enum becomes one schema in the OpenAPI document. Without
 * `enumSchema`, Swagger copies the description of whichever property it
 * meets first, so the schema's description changes when modules or
 * controllers are reordered. Every usage of an enum name that appears more
 * than once therefore sets `enumSchema: { description }`, and all usages
 * agree on it. (Ported from apps/api/test/conventions/enums.spec.ts.)
 */
const SRC = path.resolve(__dirname, "../../src");

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });

type Usage = { file: string; description?: string };

const usages = new Map<string, Usage[]>();
for (const file of walk(SRC)) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/enumName: "(\w+)"/g)) {
    // The decorator call holding this enumName: from the preceding "@" to
    // the next one.
    const start = source.lastIndexOf("@", match.index);
    const end = source.indexOf("@", match.index);
    const call = source.slice(start, end === -1 ? undefined : end);
    const description = /enumSchema:\s*{\s*description:\s*"([^"]*)"/.exec(
      call,
    )?.[1];
    const list = usages.get(match[1]) ?? [];
    list.push({ file: path.relative(SRC, file), description });
    usages.set(match[1], list);
  }
}

describe("OpenAPI enum conventions", () => {
  it("finds enum usages", () => {
    expect(usages.size).toBeGreaterThan(3);
  });

  it("describes every shared enum on each usage, consistently", () => {
    const problems: string[] = [];
    for (const [name, list] of usages) {
      if (list.length < 2) continue;
      for (const usage of list.filter((u) => u.description === undefined)) {
        problems.push(`${name} in ${usage.file}: no enumSchema description`);
      }
      const descriptions = new Set(
        list.map((u) => u.description).filter((d) => d !== undefined),
      );
      if (descriptions.size > 1) {
        problems.push(`${name}: differing descriptions ${[...descriptions]}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
