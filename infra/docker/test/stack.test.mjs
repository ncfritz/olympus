// node --test infra/docker/test/*.test.mjs
//
// stack.sh's own checks, the ones that do not need Docker: a command that
// cannot work should say so rather than exit in silence.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "..");

// A copy, because stack.sh resolves everything from its own directory and
// writes env/.current — which is a real file in the checkout.
const fixture = () => {
  const dir = mkdtempSync(join(tmpdir(), "stack-"));
  cpSync(join(source, "stack.sh"), join(dir, "stack.sh"));
  cpSync(join(source, "compose"), join(dir, "compose"), { recursive: true });
  cpSync(join(source, "env"), join(dir, "env"), { recursive: true });
  mkdirSync(join(dir, "env"), { recursive: true });
  writeFileSync(join(dir, "env", ".current"), "prod\n");
  return dir;
};

const run = (dir, ...args) =>
  spawnSync("bash", [join(dir, "stack.sh"), ...args], { encoding: "utf8" });

test("names the stack it cannot find, rather than failing silently", () => {
  const { status, stdout, stderr } = run(fixture(), "check", "nosuchstack");
  assert.notEqual(status, 0);
  assert.match(
    stdout + stderr,
    /nosuchstack/,
    "the failure has to name the stack: this exited 1 with no output at all " +
      "when compose's `die` went to a file nothing read",
  );
});

test("refuses an unknown command by name", () => {
  const { status, stderr } = run(fixture(), "frobnicate");
  assert.notEqual(status, 0);
  assert.match(stderr, /frobnicate/);
});

test("says what to do when no environment has been chosen", () => {
  const dir = mkdtempSync(join(tmpdir(), "stack-"));
  cpSync(join(source, "stack.sh"), join(dir, "stack.sh"));
  cpSync(join(source, "env"), join(dir, "env"), { recursive: true });
  // The checkout this copy came from has one; a new machine does not.
  rmSync(join(dir, "env", ".current"), { force: true });
  const { status, stderr } = run(dir, "check");
  assert.notEqual(status, 0);
  assert.match(stderr, /bootstrap/);
});
