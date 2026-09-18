import * as fs from "fs";

export type Keyed = { rule: string; target: string; message: string };

/**
 * Compares findings with an allow-list file of "<rule> <target>": reason.
 * With UPDATE_ALLOW_LIST set, rewrites the file from the current findings
 * (existing reasons are kept) - review the diff.
 */
export function loadAllowList(file: string, findings: Keyed[]) {
  const key = (f: Keyed) => `${f.rule} ${f.target}`;
  let allowed: Record<string, string> = JSON.parse(
    fs.readFileSync(file, "utf8"),
  );
  if (process.env.UPDATE_ALLOW_LIST) {
    const next: Record<string, string> = {};
    for (const f of [...findings].sort((a, b) =>
      key(a).localeCompare(key(b)),
    )) {
      next[key(f)] = allowed[key(f)] ?? f.message;
    }
    fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
    allowed = next;
  }
  const found = new Set(findings.map(key));
  return {
    unexpected: findings
      .filter((f) => !(key(f) in allowed))
      .map((f) => `${key(f)}: ${f.message}`),
    stale: Object.keys(allowed).filter((k) => !found.has(k)),
  };
}
