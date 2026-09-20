import { execSync } from "child_process";
import { join } from "path";

// Integration tests hit a real, persistent Postgres database (started via
// `docker compose up -d postgres` at the repo root) rather than a
// disposable per-run file — there's nothing to create, only to make sure
// the schema is current before the suite runs. `migrate deploy` is a
// no-op when there's nothing new to apply.
process.env.DATABASE_URL ??= "postgresql://minerva:minerva@localhost:5432/minerva_test";

execSync("npx prisma migrate deploy --schema=prisma/postgres/schema.prisma", {
  cwd: join(__dirname, "..", ".."),
  env: process.env,
  stdio: "pipe",
});
