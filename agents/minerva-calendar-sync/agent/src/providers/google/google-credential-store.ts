import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { OAuth2Client } from "google-auth-library";
import { join } from "path";

// Deliberately a local JSON file for v1, per the plan: a small dedicated
// credentials store is enough for a handful of known accounts. Swapping
// this for a DB-backed store later won't touch CalendarProvider at all.
const CREDENTIALS_DIR = join(__dirname, "..", "..", "..", ".credentials");

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
  writeFileSync(credentialPath(credential.accountLabel), JSON.stringify(credential, null, 2));
}

export function loadGoogleCredential(accountLabel: string): StoredGoogleCredential {
  const path = credentialPath(accountLabel);
  if (!existsSync(path)) {
    throw new Error(
      `No stored Google credential for "${accountLabel}" at ${path}. Run \`pnpm google:auth -- --label ${accountLabel}\` first.`,
    );
  }
  return JSON.parse(readFileSync(path, "utf8")) as StoredGoogleCredential;
}

/** Builds an OAuth2Client authorized for `accountLabel`, ready to pass into GoogleCalendarProvider. */
export function createAuthorizedGoogleClient(accountLabel: string): OAuth2Client {
  const credential = loadGoogleCredential(accountLabel);
  const client = new OAuth2Client(requireEnv("GOOGLE_OAUTH_CLIENT_ID"), requireEnv("GOOGLE_OAUTH_CLIENT_SECRET"));
  client.setCredentials({ refresh_token: credential.refreshToken });
  return client;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}
