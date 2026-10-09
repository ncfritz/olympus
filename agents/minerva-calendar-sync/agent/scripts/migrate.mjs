// Applies the pending Prisma migrations to the database DATABASE_URL names,
// before a local run of the agent (`pnpm dev`, `start`, `start:debug`,
// `start:local`). Run with the same env file as the agent:
//
//   node --env-file=dev.env scripts/migrate.mjs
//
// A postgresql:// URL uses prisma/postgres/schema.prisma, anything else the
// SQLite schema, as the prisma:deploy scripts do. Already applied, it
// changes nothing. In Docker the minerva-calendar-migrate service does this.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("migrate: DATABASE_URL is not set; pass the agent's env file");
  process.exit(1);
}
const schema = /^postgres(ql)?:/.test(url)
  ? "prisma/postgres/schema.prisma"
  : "prisma/schema.prisma";
const prisma = createRequire(import.meta.url).resolve("prisma/build/index.js");

const run = spawnSync(
  process.execPath,
  [prisma, "migrate", "deploy", `--schema=${schema}`],
  { stdio: "inherit" },
);
process.exit(run.status ?? 1);
