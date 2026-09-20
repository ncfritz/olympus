import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join } from "path";

// Same rationale as google-credential-store.ts: a small local JSON file per
// account is enough for a handful of known accounts; swapping this for a
// DB-backed store later won't touch CalendarProvider at all. Overridable so
// e2e tests can point this at an empty temp dir (see test/e2e/env-setup.ts)
// instead of the developer's real .credentials/.
const CREDENTIALS_DIR =
  process.env.MICROSOFT_CREDENTIALS_DIR ??
  join(__dirname, "..", "..", "..", ".credentials-microsoft");

export interface StoredMicrosoftCredential {
  accountLabel: string;
  refreshToken: string;
  scope: string;
  obtainedAt: string;
}

function credentialPath(accountLabel: string): string {
  return join(CREDENTIALS_DIR, `${accountLabel}.json`);
}

export function saveMicrosoftCredential(
  credential: StoredMicrosoftCredential,
): void {
  mkdirSync(CREDENTIALS_DIR, { recursive: true });
  writeFileSync(
    credentialPath(credential.accountLabel),
    JSON.stringify(credential, null, 2),
  );
}

/** Returns undefined instead of throwing when nothing has been stored yet for this account. */
export function tryLoadMicrosoftCredential(
  accountLabel: string,
): StoredMicrosoftCredential | undefined {
  const path = credentialPath(accountLabel);
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8")) as StoredMicrosoftCredential;
}

export function loadMicrosoftCredential(
  accountLabel: string,
): StoredMicrosoftCredential {
  const credential = tryLoadMicrosoftCredential(accountLabel);
  if (!credential) {
    throw new Error(
      `No stored Microsoft credential for "${accountLabel}" at ${credentialPath(accountLabel)}.`,
    );
  }
  return credential;
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

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}
