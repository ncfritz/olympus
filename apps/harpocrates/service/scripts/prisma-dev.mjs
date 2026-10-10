// Prisma's CLI against the development database: dev.env, with
// DATABASE_URL read from DATABASE_URL_FILE when that is how it is given
// (ADR 0019), as the stack's harpocrates-migrate does from its secret.
// Prisma itself only reads DATABASE_URL.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

process.loadEnvFile("dev.env");
if (!process.env.DATABASE_URL && process.env.DATABASE_URL_FILE) {
  process.env.DATABASE_URL = readFileSync(
    process.env.DATABASE_URL_FILE,
    "utf8",
  ).trim();
}
const { status } = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", ...process.argv.slice(2)],
  { stdio: "inherit" },
);
process.exit(status ?? 1);
