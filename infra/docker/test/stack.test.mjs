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
  cpSync(join(source, "check.mjs"), join(dir, "check.mjs"));
  cpSync(join(source, "compose"), join(dir, "compose"), { recursive: true });
  cpSync(join(source, "env"), join(dir, "env"), { recursive: true });
  mkdirSync(join(dir, "env"), { recursive: true });
  writeFileSync(join(dir, "env", ".current"), "prod\n");
  return dir;
};

const run = (dir, args, env = {}) =>
  spawnSync("bash", [join(dir, "stack.sh"), ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });

test("names the stack it cannot find, rather than failing silently", () => {
  const { status, stdout, stderr } = run(fixture(), ["check", "nosuchstack"]);
  assert.notEqual(status, 0);
  assert.match(
    stdout + stderr,
    /nosuchstack/,
    "the failure has to name the stack: this exited 1 with no output at all " +
      "when compose's `die` went to a file nothing read",
  );
});

test("refuses an unknown command by name", () => {
  const { status, stderr } = run(fixture(), ["frobnicate"]);
  assert.notEqual(status, 0);
  assert.match(stderr, /frobnicate/);
});

test("says what to do when no environment has been chosen", () => {
  const dir = mkdtempSync(join(tmpdir(), "stack-"));
  cpSync(join(source, "stack.sh"), join(dir, "stack.sh"));
  cpSync(join(source, "env"), join(dir, "env"), { recursive: true });
  // The checkout this copy came from has one; a new machine does not.
  rmSync(join(dir, "env", ".current"), { force: true });
  const { status, stderr } = run(dir, ["check"]);
  assert.notEqual(status, 0);
  assert.match(stderr, /bootstrap/);
});

test("does not call a remote stack's secrets missing", () => {
  // The paths in nas.yml are on the NAS. Checking them against this
  // machine's filesystem reported all eight as missing when they were
  // sitting on the other end of the Docker context.
  const { stdout, stderr } = run(fixture(), ["check", "nas"], {
    DOCKER_CONTEXT: "nas",
  });
  const all = stdout + stderr;
  assert.match(all, /not checked here/);
  assert.doesNotMatch(all, /missing secret/);
});

// A `docker` that reports the tag Compose would interpolate instead of
// running anything: `config --format json` answers an empty project (so
// `check` finds no secrets to look at), everything else prints its command
// and OLYMPUS_TAG.
const stubDocker = () => {
  const bin = mkdtempSync(join(tmpdir(), "docker-"));
  writeFileSync(
    join(bin, "docker"),
    `#!/usr/bin/env bash
case " $* " in
  *" --format json "*) echo '{}' ;;
  *" up "*) echo "up OLYMPUS_TAG=$OLYMPUS_TAG" ;;
  *" pull "*) echo "pull OLYMPUS_TAG=$OLYMPUS_TAG" ;;
esac
`,
    { mode: 0o755 },
  );
  return { PATH: `${bin}:${process.env.PATH}` };
};

test("up runs the env file's OLYMPUS_TAG by default", () => {
  const { status, stdout } = run(fixture(), ["up", "olympus"], stubDocker());
  assert.equal(status, 0);
  assert.match(stdout, /up OLYMPUS_TAG=(?!fix123)\S+/);
});

test("up --tag runs that tag instead, this once, and says so", () => {
  for (const args of [
    ["up", "--tag", "fix123", "olympus"],
    ["up", "olympus", "--tag=fix123"],
  ]) {
    const { status, stdout, stderr } = run(fixture(), args, stubDocker());
    assert.equal(status, 0, stderr);
    assert.match(stdout, /up OLYMPUS_TAG=fix123/);
    assert.match(stderr, /OLYMPUS_TAG=fix123 for this run/);
    // --tag is not taken for a stack's name.
    assert.doesNotMatch(stdout + stderr, /no stack/);
  }
});

test("pull --tag pulls that tag", () => {
  const { status, stdout } = run(
    fixture(),
    ["pull", "olympus", "--tag", "fix123"],
    stubDocker(),
  );
  assert.equal(status, 0);
  assert.match(stdout, /pull OLYMPUS_TAG=fix123/);
});

test("refuses --tag without a tag, or with one Docker would not accept", () => {
  for (const args of [
    ["up", "olympus", "--tag"],
    ["up", "--tag=", "olympus"],
    ["up", "--tag", "not a tag", "olympus"],
    ["up", "--tag", ".hidden", "olympus"],
  ]) {
    const { status, stderr } = run(fixture(), args, stubDocker());
    assert.notEqual(status, 0, args.join(" "));
    assert.match(stderr, /--tag/);
  }
});

// A checkout of its own (build tags images with the commit, and refuses a
// dirty tree), and a `docker` whose compose config names two of our images
// and whose `buildx bake` prints the targets it was given.
const buildFixture = () => {
  const root = mkdtempSync(join(tmpdir(), "repo-"));
  const dir = join(root, "infra", "docker");
  mkdirSync(dir, { recursive: true });
  cpSync(join(source, "stack.sh"), join(dir, "stack.sh"));
  cpSync(join(source, "compose"), join(dir, "compose"), { recursive: true });
  cpSync(join(source, "env"), join(dir, "env"), { recursive: true });
  writeFileSync(join(dir, "env", ".current"), "local\n");
  writeFileSync(join(root, ".gitignore"), "infra/docker/env/.current\n");
  const git = (...args) =>
    spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
  git("init", "-q");
  git("add", "-A");
  git(
    "-c",
    "user.name=t",
    "-c",
    "user.email=t@example.com",
    "commit",
    "-qm",
    "fixture",
  );

  const bin = mkdtempSync(join(tmpdir(), "docker-"));
  writeFileSync(
    join(bin, "docker"),
    `#!/usr/bin/env bash
case " $* " in
  *" --format json "*) echo '{"services":{"olympus-api":{"image":"olympus/api:dev"},"olympus-site":{"image":"olympus/site:dev"}}}' ;;
  *" bake "*)
    shift 2
    echo "bake $*"
    case " $* " in *" \${FAIL_TARGET:-none} "*) exit 1 ;; esac ;;
esac
`,
    { mode: 0o755 },
  );
  return { dir, env: { PATH: `${bin}:${process.env.PATH}` } };
};

test("build makes one image at a time by default", () => {
  const { dir, env } = buildFixture();
  const { status, stdout, stderr } = run(
    dir,
    ["build", "--load", "olympus"],
    env,
  );
  assert.equal(status, 0, stderr);
  const bakes = stdout.split("\n").filter((line) => line.startsWith("bake "));
  assert.deepEqual(bakes, ["bake --load api", "bake --load site"]);
});

test("build --parallel makes them in one bake", () => {
  const { dir, env } = buildFixture();
  const { status, stdout, stderr } = run(
    dir,
    ["build", "--load", "--parallel", "olympus"],
    env,
  );
  assert.equal(status, 0, stderr);
  const bakes = stdout.split("\n").filter((line) => line.startsWith("bake "));
  assert.deepEqual(bakes, ["bake --load api site"]);
  assert.match(stdout, /in parallel/);
});

test("build stops at the image that fails, and names it", () => {
  const { dir, env } = buildFixture();
  const { status, stdout, stderr } = run(dir, ["build", "--load", "olympus"], {
    ...env,
    FAIL_TARGET: "api",
  });
  assert.notEqual(status, 0);
  assert.match(stderr, /api failed to build/);
  assert.doesNotMatch(stdout, /bake --load site/);
});
