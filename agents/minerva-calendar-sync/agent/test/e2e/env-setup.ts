import { execSync } from "child_process";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// e2e tests must never touch the developer's real .env — an empty
// SYNCED_CALENDARS keeps SyncBootstrapService from starting any real sync
// against live Google credentials, and DATABASE_URL points at a disposable
// temp SQLite file rather than the dev database.
const dir = mkdtempSync(join(tmpdir(), "minerva-e2e-"));
process.env.DATABASE_URL = `file:${join(dir, "e2e.db")}`;
process.env.SYNCED_CALENDARS = "[]";
process.env.AUTH_JWT_SECRET = "e2e-test-secret-do-not-use-in-prod";
process.env.AUTH_OIDC_PROVIDERS = "[]";
process.env.AUTH_ALLOWED_EMAILS = "e2e@example.com";

execSync("npx prisma db push --skip-generate", {
  cwd: join(__dirname, "..", ".."),
  env: process.env,
  stdio: "pipe",
});
