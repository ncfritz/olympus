// node --test infra/docker/hasura/test/*.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const entrypoint = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "entrypoint.sh",
);

/** Runs the entrypoint with a stand-in for the image's own, which prints its env and args. */
const run = (env) => {
  const dir = mkdtempSync(join(tmpdir(), "hasura-"));
  const next = join(dir, "next.sh");
  writeFileSync(
    next,
    '#!/bin/sh\nenv | grep -E "^HASURA_" | sort\necho "args: $*"\n',
  );
  chmodSync(next, 0o755);
  const secret = (name, content) => {
    const path = join(dir, name);
    writeFileSync(path, content);
    return path;
  };
  const result = spawnSync("sh", [entrypoint, "graphql-engine", "serve"], {
    env: {
      PATH: process.env.PATH,
      OLYMPUS_NEXT_ENTRYPOINT: next,
      ...env(secret),
    },
    encoding: "utf8",
  });
  return { ...result, lines: result.stdout.trim().split("\n") };
};

test("turns each _FILE into its variable, without the trailing newline", () => {
  const r = run((secret) => ({
    HASURA_GRAPHQL_ADMIN_SECRET_FILE: secret("admin", "s3cret\n"),
    HASURA_GRAPHQL_DATABASE_URL_FILE: secret(
      "db",
      "postgres://olympus:pw@postgres:5432/olympus\n",
    ),
  }));
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.lines, [
    "HASURA_GRAPHQL_ADMIN_SECRET=s3cret",
    "HASURA_GRAPHQL_DATABASE_URL=postgres://olympus:pw@postgres:5432/olympus",
    "args: graphql-engine serve",
  ]);
});

test("passes plain variables through untouched", () => {
  const r = run(() => ({ HASURA_GRAPHQL_ADMIN_SECRET: "plain" }));
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.lines, [
    "HASURA_GRAPHQL_ADMIN_SECRET=plain",
    "args: graphql-engine serve",
  ]);
});

test("keeps characters a shell would interpret", () => {
  const value = "a$b`c'd\"e f;g";
  const r = run((secret) => ({
    HASURA_GRAPHQL_ADMIN_SECRET_FILE: secret("admin", value),
  }));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.lines[0], `HASURA_GRAPHQL_ADMIN_SECRET=${value}`);
});

test("refuses both a variable and its file", () => {
  const r = run((secret) => ({
    HASURA_GRAPHQL_ADMIN_SECRET: "a",
    HASURA_GRAPHQL_ADMIN_SECRET_FILE: secret("admin", "b"),
  }));
  assert.equal(r.status, 1);
  assert.match(
    r.stderr,
    /HASURA_GRAPHQL_ADMIN_SECRET and HASURA_GRAPHQL_ADMIN_SECRET_FILE are both set/,
  );
});

test("refuses a file it cannot read, and starts nothing", () => {
  const r = run(() => ({
    HASURA_GRAPHQL_DATABASE_URL_FILE: "/run/secrets/missing",
  }));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /cannot read \/run\/secrets\/missing/);
  assert.equal(r.stdout, "");
});
