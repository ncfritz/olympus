// node --test infra/docker/rabbitmq/test/*.test.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildDefinitions, hashPassword } from "../definitions.mjs";

const script = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "definitions.mjs",
);
const spec = JSON.parse(
  readFileSync(join(dirname(script), "users.json"), "utf8"),
);

test("hashes passwords the way RabbitMQ does", () => {
  // The published example: "test12" with the salt 908DC60A.
  assert.equal(
    hashPassword("test12", Buffer.from("908DC60A", "hex")),
    "kI3GCqW5JLMJa4iX1lo7X4D6XbYqlLgxIs30+P6tENUV2POR",
  );
});

test("salts every hash", () => {
  assert.notEqual(hashPassword("same"), hashPassword("same"));
});

test("confines each service to its own vhosts", () => {
  const definitions = buildDefinitions(spec, () => "pw");
  const vhostsOf = (user) =>
    definitions.permissions.filter((p) => p.user === user).map((p) => p.vhost);
  assert.deepEqual(vhostsOf("olympus-dev"), ["/dionysus-dev"]);
  assert.deepEqual(vhostsOf("dionysus-search-agent"), ["/dionysus"]);
  assert.deepEqual(vhostsOf("admin").sort(), ["/dionysus", "/dionysus-dev"]);
  const tagged = definitions.users.filter((u) => u.tags.length);
  assert.deepEqual(
    tagged.map((u) => u.name),
    ["admin"],
  );
});

test("every user's vhosts exist", () => {
  const vhosts = new Set(spec.vhosts);
  for (const user of spec.users) {
    for (const vhost of user.vhosts)
      assert.ok(vhosts.has(vhost), `${user.name}: ${vhost}`);
  }
});

test("refuses to write without every password", () => {
  const dir = mkdtempSync(join(tmpdir(), "rmq-"));
  assert.throws(() => execFileSync("node", [script, dir], { stdio: "pipe" }));
});

test("generates missing passwords and writes a private file", () => {
  const dir = mkdtempSync(join(tmpdir(), "rmq-"));
  mkdirSync(join(dir, "rabbitmq"));
  writeFileSync(join(dir, "rabbitmq", "admin.password"), "kept\n");
  execFileSync("node", [script, dir, "--generate-missing"], { stdio: "pipe" });

  assert.equal(
    readFileSync(join(dir, "rabbitmq", "admin.password"), "utf8"),
    "kept\n",
  );
  const out = join(dir, "rabbitmq_definitions");
  assert.equal(statSync(out).mode & 0o777, 0o600);
  const definitions = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(definitions.users.length, spec.users.length);
  // The hash of the kept password verifies against its salt.
  const admin = definitions.users.find((u) => u.name === "admin");
  const salt = Buffer.from(admin.password_hash, "base64").subarray(0, 4);
  assert.equal(admin.password_hash, hashPassword("kept", salt));
});
