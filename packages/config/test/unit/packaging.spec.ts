import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * What a workspace package ships, checked across the whole workspace
 * rather than inside any one of it.
 *
 * `pnpm deploy` copies a workspace dependency the way `pnpm pack` would.
 * With no `files` field and no .npmignore that means the package's own
 * .gitignore decides — and a package that builds to dist almost certainly
 * ignores dist, so it ships without the one thing it is for. That is not
 * visible in the workspace, where everything resolves through links; it
 * is visible the first time the package is deployed, as a missing module
 * at startup.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../../..");

/**
 * The globs from pnpm-workspace.yaml, read rather than copied.
 *
 * A copy is worse than no check at all: adding a glob to the workspace and
 * not to the copy leaves everything under it silently uncovered, and nothing
 * fails to say so. The file's `packages:` list is a flat sequence of quoted
 * strings, so it needs a reader rather than a YAML parser.
 */
const WORKSPACE_GLOBS = ((): string[] => {
  const file = fs.readFileSync(path.join(repo, "pnpm-workspace.yaml"), "utf8");
  const globs: string[] = [];
  let inPackages = false;
  for (const line of file.split("\n")) {
    if (/^packages:/.test(line)) {
      inPackages = true;
      continue;
    }
    if (!inPackages) continue;
    const entry = /^\s+-\s*["']?([^"'#\s]+)["']?/.exec(line);
    if (entry !== null) {
      globs.push(entry[1]!);
      continue;
    }
    // An indented comment or a blank line is still inside the list;
    // anything at the left margin has ended it.
    if (/^\S/.test(line)) break;
  }
  return globs;
})();

const directoriesIn = (parent: string): string[] => {
  const full = path.join(repo, parent);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(parent, entry.name));
};

const expand = (glob: string): string[] => {
  const star = glob.indexOf("*");
  if (star === -1) return [glob];
  const parent = glob.slice(0, star - 1);
  const rest = glob.slice(star + 1);
  return directoriesIn(parent).map((dir) => `${dir}${rest}`);
};

interface Package {
  dir: string;
  name: string;
  scripts: Record<string, string>;
  files?: string[];
  main?: string;
  exports?: unknown;
}

const packages: Package[] = WORKSPACE_GLOBS.flatMap(expand)
  .filter((dir) => fs.existsSync(path.join(repo, dir, "package.json")))
  .map((dir) => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(repo, dir, "package.json"), "utf8"),
    ) as Omit<Package, "dir" | "scripts"> & {
      name: string;
      scripts?: Record<string, string>;
    };
    return { ...manifest, dir, scripts: manifest.scripts ?? {} };
  });

/** Every path an entry point resolves to: main, and exports at any depth. */
const entryPoints = (pkg: Package): string[] => {
  const found: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === "string") {
      if (node.startsWith(".")) found.push(node);
      return;
    }
    if (node && typeof node === "object") {
      Object.values(node as Record<string, unknown>).forEach(walk);
    }
  };
  walk(pkg.exports);
  if (pkg.main) found.push(pkg.main);
  return found;
};

/** `files` entries are directories or paths, matched by prefix as npm does. */
const shipped = (pkg: Package, entry: string): boolean => {
  const target = entry.replace(/^\.\//, "");
  return (pkg.files ?? []).some((pattern) => {
    const file = pattern.replace(/^\.?\//, "").replace(/\/$/, "");
    return target === file || target.startsWith(`${file}/`);
  });
};

/**
 * A package that is packed to be consumed: its output is generated, so it
 * is not in git, and something copies it by packing the package.
 *
 * A Next.js app is not one. Nothing depends on it, and its image copies
 * the traced `.next/standalone` output rather than packing it, so `files`
 * has no part in what it ships.
 */
const builds = (pkg: Package): boolean =>
  pkg.scripts.build !== undefined && !/\bnext build\b/.test(pkg.scripts.build);

describe("what workspace packages ship", () => {
  it("reads the workspace's own globs", () => {
    // Each of these is a shape the reader has to handle: a plain glob, one
    // nested two deep, and the one that arrived last.
    expect(WORKSPACE_GLOBS).toEqual(
      expect.arrayContaining([
        "apps/*",
        "packages/*",
        "agents/*/console",
        "tools/*",
      ]),
    );
  });

  it("finds the workspace", () => {
    expect(packages.map((pkg) => pkg.name)).toContain("@ncfritz/olympus-sdk");
    expect(packages.map((pkg) => pkg.name)).toContain(
      "@ncfritz/olympus-auth-tester",
    );
  });

  it("declares `files` wherever the output is built", () => {
    const missing = packages
      .filter((pkg) => builds(pkg) && !pkg.files?.length)
      .map((pkg) => pkg.dir);

    expect(
      missing,
      "a built package without `files` ships whatever its own .gitignore allows",
    ).toEqual([]);
  });

  it("ships what its entry points resolve to", () => {
    const unshipped = packages.filter(builds).flatMap((pkg) =>
      entryPoints(pkg)
        .filter((entry) => !shipped(pkg, entry))
        .map((entry) => `${pkg.dir}: ${entry}`),
    );

    expect(
      unshipped,
      "an entry point outside `files` is a module the deployed tree will not have",
    ).toEqual([]);
  });
});
