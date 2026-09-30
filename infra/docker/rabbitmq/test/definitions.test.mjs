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
import { buildDefinitions, hashPassword, shovelUri } from "../definitions.mjs";

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

test("gives the weather shovel only what it needs, on its two vhosts", () => {
  const definitions = buildDefinitions(spec, () => "pw");
  const of = (vhost) =>
    definitions.permissions.find(
      (p) => p.user === "weather-shovel" && p.vhost === vhost,
    );
  // Reads the prod exchange through a queue of its own naming.
  assert.deepEqual(of("/dionysus"), {
    user: "weather-shovel",
    vhost: "/dionysus",
    configure: "^amq\\.gen-.*",
    write: "^amq\\.gen-.*",
    read: "^(weather\\.station\\.reports|amq\\.gen-.*)$",
  });
  // Publishes to the dev exchange and nothing else.
  assert.deepEqual(of("/dionysus-dev"), {
    user: "weather-shovel",
    vhost: "/dionysus-dev",
    configure: "^$",
    write: "^weather\\.station\\.reports$",
    read: "^$",
  });
  const matches = (pattern, name) => new RegExp(pattern).test(name);
  assert.ok(matches(of("/dionysus").read, "weather.station.reports"));
  assert.ok(
    matches(of("/dionysus").configure, "amq.gen-JzTY20BRgKO-HjmUJj0wLg"),
  );
  assert.ok(!matches(of("/dionysus").read, "notifications.trigger"));
  assert.ok(matches(of("/dionysus-dev").write, "weather.station.reports"));
  assert.ok(
    !matches(of("/dionysus-dev").write, "weather.station.reports.olympus_dev"),
  );
  // Nobody else changed: every other user still has everything, but only
  // on its own vhosts.
  for (const p of definitions.permissions.filter(
    (p) => p.user !== "weather-shovel",
  )) {
    assert.equal(p.configure, ".*", p.user);
  }
});

test("declares the relay's exchanges on both vhosts", () => {
  const definitions = buildDefinitions(spec, () => "pw");
  assert.deepEqual(
    definitions.exchanges.map((e) => `${e.vhost} ${e.name} ${e.type}`),
    [
      "/dionysus weather.station.reports fanout",
      "/dionysus-dev weather.station.reports fanout",
    ],
  );
  assert.ok(definitions.exchanges.every((e) => e.durable && !e.auto_delete));
});

test("shovels prod's weather lines to dev", () => {
  const definitions = buildDefinitions(spec, (user) => `${user}-pw/+`);
  assert.equal(definitions.parameters.length, 1);
  const [shovel] = definitions.parameters;
  assert.equal(shovel.component, "shovel");
  assert.equal(shovel.vhost, "/dionysus");
  assert.equal(shovel.name, "weather-relay");
  assert.equal(
    shovel.value["src-uri"],
    "amqp://weather-shovel:weather-shovel-pw%2F%2B@localhost:5672/%2Fdionysus",
  );
  assert.equal(
    shovel.value["dest-uri"],
    "amqp://weather-shovel:weather-shovel-pw%2F%2B@localhost:5672/%2Fdionysus-dev",
  );
  assert.equal(shovel.value["src-exchange"], "weather.station.reports");
  assert.equal(shovel.value["dest-exchange"], "weather.station.reports");
  assert.equal(shovel.value["ack-mode"], "on-confirm");
});

test("every shovel's user and exchanges exist", () => {
  const users = new Map(spec.users.map((u) => [u.name, u]));
  const exchanges = new Set(spec.exchanges.map((e) => `${e.vhost} ${e.name}`));
  for (const shovel of spec.shovels) {
    const user = users.get(shovel.user);
    assert.ok(user, shovel.user);
    for (const end of [shovel.source, shovel.destination]) {
      assert.ok(
        user.vhosts.includes(end.vhost),
        `${shovel.name}: ${end.vhost}`,
      );
      assert.ok(exchanges.has(`${end.vhost} ${end.exchange}`), end.exchange);
    }
  }
});

test("encodes a shovel URI's parts", () => {
  assert.equal(
    shovelUri("u", "p@ss", "/v"),
    "amqp://u:p%40ss@localhost:5672/%2Fv",
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
