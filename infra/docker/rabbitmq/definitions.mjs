#!/usr/bin/env node
// Writes RabbitMQ's definitions file (users, vhosts, permissions, and the
// exchanges and shovels that cross vhosts) from
// users.json and one password file per user, for the broker to load at
// boot (ADR 0019). The output holds password hashes: it is a secret, and
// it is written into the secrets directory, never the repository.
//
//   node infra/docker/rabbitmq/definitions.mjs <secrets-dir> [--generate-missing]
//
// Reads   <secrets-dir>/rabbitmq/<user>.password
// Writes  <secrets-dir>/rabbitmq_definitions (mode 600)
//
// --generate-missing creates a random password for any user without one,
// which is how a new host or the laptop starts.

import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** RabbitMQ's rabbit_password_hashing_sha256: salt ‖ sha256(salt ‖ password). */
export const hashPassword = (password, salt = randomBytes(4)) =>
  Buffer.concat([
    salt,
    createHash("sha256")
      .update(Buffer.concat([salt, Buffer.from(password, "utf8")]))
      .digest(),
  ]).toString("base64");

/**
 * A shovel's URI: the broker's own AMQP listener, as `user`, on `vhost`.
 * It carries the user's password, which is one more reason the written
 * definitions are a secret.
 */
export const shovelUri = (user, password, vhost) =>
  `amqp://${encodeURIComponent(user)}:${encodeURIComponent(password)}` +
  `@localhost:5672/${encodeURIComponent(vhost)}`;

/** Everything on `vhost`, the default for a service in its own vhosts. */
const ALL = { configure: ".*", write: ".*", read: ".*" };

/**
 * The definitions document for `spec`, with `passwordOf(user)` for each
 * user. `spec.exchanges` are declared by the broker itself, which a
 * shovel between vhosts needs (ADR 0025): its ends must exist before any
 * service has declared them. `spec.shovels` move everything from an
 * exchange in one vhost to an exchange in another.
 */
export const buildDefinitions = (spec, passwordOf) => ({
  vhosts: spec.vhosts.map((name) => ({ name })),
  users: spec.users.map((user) => ({
    name: user.name,
    password_hash: hashPassword(passwordOf(user.name)),
    hashing_algorithm: "rabbit_password_hashing_sha256",
    tags: user.tags ?? [],
  })),
  // Each service may declare, publish to and consume from anything in its
  // own vhosts, and nothing in any other. A user with `permissions` for a
  // vhost gets exactly those there instead (the shovel's user).
  permissions: spec.users.flatMap((user) =>
    user.vhosts.map((vhost) => ({
      user: user.name,
      vhost,
      ...(user.permissions?.[vhost] ?? ALL),
    })),
  ),
  exchanges: (spec.exchanges ?? []).map((exchange) => ({
    name: exchange.name,
    vhost: exchange.vhost,
    type: exchange.type,
    durable: true,
    auto_delete: false,
    internal: false,
    arguments: {},
  })),
  parameters: (spec.shovels ?? []).map((shovel) => ({
    vhost: shovel.source.vhost,
    component: "shovel",
    name: shovel.name,
    value: {
      "src-protocol": "amqp091",
      "src-uri": shovelUri(
        shovel.user,
        passwordOf(shovel.user),
        shovel.source.vhost,
      ),
      "src-exchange": shovel.source.exchange,
      "src-exchange-key": "#",
      "dest-protocol": "amqp091",
      "dest-uri": shovelUri(
        shovel.user,
        passwordOf(shovel.user),
        shovel.destination.vhost,
      ),
      "dest-exchange": shovel.destination.exchange,
      // A message leaves the source only once the destination has it.
      "ack-mode": "on-confirm",
      "reconnect-delay": 5,
    },
  })),
});

const main = (argv) => {
  const [secretsDir, ...flags] = argv;
  if (!secretsDir) {
    console.error("usage: definitions.mjs <secrets-dir> [--generate-missing]");
    return 2;
  }
  const generate = flags.includes("--generate-missing");
  const here = dirname(fileURLToPath(import.meta.url));
  const spec = JSON.parse(readFileSync(join(here, "users.json"), "utf8"));
  const passwords = join(secretsDir, "rabbitmq");
  mkdirSync(passwords, { recursive: true, mode: 0o700 });

  const missing = [];
  for (const { name } of spec.users) {
    const file = join(passwords, `${name}.password`);
    if (existsSync(file)) continue;
    if (!generate) {
      missing.push(file);
      continue;
    }
    writeFileSync(file, `${randomBytes(24).toString("base64url")}\n`, {
      mode: 0o600,
    });
    console.log(`generated ${file}`);
  }
  if (missing.length) {
    console.error(
      `missing passwords (or pass --generate-missing):\n  ${missing.join("\n  ")}`,
    );
    return 1;
  }

  const definitions = buildDefinitions(spec, (name) =>
    readFileSync(join(passwords, `${name}.password`), "utf8").trim(),
  );
  const out = join(secretsDir, "rabbitmq_definitions");
  writeFileSync(out, `${JSON.stringify(definitions, null, 2)}\n`, {
    mode: 0o600,
  });
  console.log(
    `wrote ${out}: ${definitions.users.length} users, ${definitions.vhosts.length} vhosts, ` +
      `${definitions.exchanges.length} exchanges, ${definitions.parameters.length} shovels`,
  );
  return 0;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
