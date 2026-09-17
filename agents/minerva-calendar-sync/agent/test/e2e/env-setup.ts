import { execSync } from "child_process";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// e2e tests must never touch the developer's real .env — DATABASE_URL
// points at a disposable temp SQLite file rather than the dev database (so
// synced calendars, which are entirely DB-backed, start empty per test file
// too), and GOOGLE_CREDENTIALS_DIR/MICROSOFT_CREDENTIALS_DIR point at empty
// temp dirs rather than the developer's real .credentials/.credentials-microsoft
// (which listStoredAccountLabels would otherwise read from directly,
// leaking whatever accounts happen to be authorized on this machine into
// test results).
const dir = mkdtempSync(join(tmpdir(), "minerva-e2e-"));
process.env.DATABASE_URL = `file:${join(dir, "e2e.db")}`;
process.env.GOOGLE_CREDENTIALS_DIR = join(dir, "credentials");
process.env.MICROSOFT_CREDENTIALS_DIR = join(dir, "credentials-microsoft");
process.env.AUTH_JWT_SECRET = "e2e-test-secret-do-not-use-in-prod";
process.env.AUTH_OIDC_PROVIDERS = "[]";
process.env.AUTH_ALLOWED_EMAILS = "e2e@example.com";

execSync("npx prisma db push --skip-generate", {
  cwd: join(__dirname, "..", ".."),
  env: process.env,
  stdio: "pipe",
});
