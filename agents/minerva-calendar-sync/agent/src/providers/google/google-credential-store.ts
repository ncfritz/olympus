import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { OAuth2Client } from "google-auth-library";
import { join } from "path";

// Deliberately a local JSON file for v1, per the plan: a small dedicated
// credentials store is enough for a handful of known accounts. Swapping
// this for a DB-backed store later won't touch CalendarProvider at all.
// Overridable so e2e tests (see test/e2e/env-setup.ts) can point this at an
// empty temp dir instead of the developer's real .credentials/ — otherwise
// listStoredAccountLabels would read whatever's actually been authorized on
// this machine straight into test results.
const CREDENTIALS_DIR =
  process.env.GOOGLE_CREDENTIALS_DIR ??
  join(__dirname, "..", "..", "..", ".credentials");

export interface StoredGoogleCredential {
  accountLabel: string;
  refreshToken: string;
  scope: string;
  obtainedAt: string;
}

function credentialPath(accountLabel: string): string {
  return join(CREDENTIALS_DIR, `${accountLabel}.json`);
}

export function saveGoogleCredential(credential: StoredGoogleCredential): void {
  mkdirSync(CREDENTIALS_DIR, { recursive: true });
  writeFileSync(
    credentialPath(credential.accountLabel),
    JSON.stringify(credential, null, 2),
  );
}

export function loadGoogleCredential(
  accountLabel: string,
): StoredGoogleCredential {
  const credential = tryLoadGoogleCredential(accountLabel);
  if (!credential) {
    throw new Error(
      `No stored Google credential for "${accountLabel}" at ${credentialPath(accountLabel)}. ` +
        `Run \`pnpm google:auth -- --label ${accountLabel}\` first.`,
    );
  }
  return credential;
}

/** Same as loadGoogleCredential, but returns undefined instead of throwing when nothing has been stored yet. */
export function tryLoadGoogleCredential(
  accountLabel: string,
): StoredGoogleCredential | undefined {
  const path = credentialPath(accountLabel);
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8")) as StoredGoogleCredential;
}

/**
 * Every account label with a stored credential, whether or not it's used by
 * any configured calendar — e.g. a just-authorized account that hasn't had
 * a calendar added to it yet still needs to show up as "connected".
 */
export function listStoredAccountLabels(): string[] {
  if (!existsSync(CREDENTIALS_DIR)) return [];
  return readdirSync(CREDENTIALS_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.slice(0, -".json".length));
}

/** Builds an OAuth2Client authorized for `accountLabel`, ready to pass into GoogleCalendarProvider. */
export function createAuthorizedGoogleClient(
  accountLabel: string,
): OAuth2Client {
  const credential = loadGoogleCredential(accountLabel);
  const client = new OAuth2Client(
    requireEnv("GOOGLE_OAUTH_CLIENT_ID"),
    requireEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
  );
  client.setCredentials({ refresh_token: credential.refreshToken });
  return client;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}
