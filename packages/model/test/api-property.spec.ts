import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";
import { checkApiProperties, type Finding } from "./support/apiPropertyChecker";

/**
 * Every model property's @ApiProperty must agree with its declared type
 * (docs/conventions/model.md). Known exceptions live in
 * api-property.allow.json as "<rule> <Class>.<property>": "<reason>".
 * The list may only shrink: a new finding fails, and so does an entry that
 * no longer matches anything.
 */
const ALLOW_FILE = path.join(__dirname, "api-property.allow.json");
const allowed: Record<string, string> = JSON.parse(
  fs.readFileSync(ALLOW_FILE, "utf8"),
);
const key = (f: Finding) => `${f.rule} ${f.target}`;

describe("@ApiProperty matches declared types", () => {
  const findings = checkApiProperties(path.join(__dirname, ".."));

  // `pnpm check:allow-update` rewrites the allow-list from the current
  // findings. Use it only to record a deliberate baseline; review the diff.
  if (process.env.UPDATE_ALLOW_LIST) {
    const next: Record<string, string> = {};
    for (const f of [...findings].sort((a, b) =>
      key(a).localeCompare(key(b)),
    )) {
      next[key(f)] = allowed[key(f)] ?? `${f.location}: ${f.message}`;
    }
    fs.writeFileSync(ALLOW_FILE, `${JSON.stringify(next, null, 2)}\n`);
    Object.assign(allowed, next);
    for (const k of Object.keys(allowed)) if (!(k in next)) delete allowed[k];
  }

  it("has no findings outside the allow-list", () => {
    const unexpected = findings
      .filter((f) => !(key(f) in allowed))
      .map((f) => `${f.location}  ${key(f)}: ${f.message}`);
    expect(unexpected).toEqual([]);
  });

  it("has no stale allow-list entries", () => {
    const found = new Set(findings.map(key));
    expect(Object.keys(allowed).filter((k) => !found.has(k))).toEqual([]);
  });
});
