import { Inject, Injectable } from "@nestjs/common";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { OAuth2Client } from "google-auth-library";
import { join } from "path";
import {
  googleConfig,
  type GoogleConfigType,
} from "../../config/configuration";

export interface StoredGoogleCredential {
  accountLabel: string;
  refreshToken: string;
  scope: string;
  obtainedAt: string;
}

/**
 * Connected Google accounts' refresh tokens, one JSON file per account in
 * GOOGLE_CREDENTIALS_DIR (default agent/.credentials). A small local store
 * is enough for a handful of known accounts; swapping it for a DB-backed one
 * later won't touch CalendarProvider. The e2e tests point it at an empty
 * temporary directory so the developer's real accounts never show up in
 * test results.
 */
@Injectable()
export class GoogleCredentialStore {
  constructor(
    @Inject(googleConfig.KEY) private readonly google: GoogleConfigType,
  ) {}

  save(credential: StoredGoogleCredential): void {
    mkdirSync(this.google.credentialsDir, { recursive: true });
    writeFileSync(
      this.credentialPath(credential.accountLabel),
      JSON.stringify(credential, null, 2),
    );
  }

  load(accountLabel: string): StoredGoogleCredential {
    const credential = this.tryLoad(accountLabel);
    if (!credential) {
      throw new Error(
        `No stored Google credential for "${accountLabel}" at ${this.credentialPath(accountLabel)}. ` +
          `Run \`pnpm google:auth -- --label ${accountLabel}\` first.`,
      );
    }
    return credential;
  }

  /** Same as load, but returns undefined instead of throwing when nothing has been stored yet. */
  tryLoad(accountLabel: string): StoredGoogleCredential | undefined {
    const path = this.credentialPath(accountLabel);
    if (!existsSync(path)) return undefined;
    return JSON.parse(readFileSync(path, "utf8")) as StoredGoogleCredential;
  }

  /**
   * Every account label with a stored credential, whether or not it's used by
   * any configured calendar — e.g. a just-authorized account that hasn't had
   * a calendar added to it yet still needs to show up as "connected".
   */
  listAccountLabels(): string[] {
    if (!existsSync(this.google.credentialsDir)) return [];
    return readdirSync(this.google.credentialsDir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.slice(0, -".json".length));
  }

  /** The OAuth client ID and secret; throws when either isn't configured. */
  oauthClient(): { clientId: string; clientSecret: string } {
    return {
      clientId: required("GOOGLE_OAUTH_CLIENT_ID", this.google.clientId),
      clientSecret: required(
        "GOOGLE_OAUTH_CLIENT_SECRET",
        this.google.clientSecret,
      ),
    };
  }

  /** Builds an OAuth2Client authorized for `accountLabel`, ready to pass into GoogleCalendarProvider. */
  createAuthorizedClient(accountLabel: string): OAuth2Client {
    const credential = this.load(accountLabel);
    const { clientId, clientSecret } = this.oauthClient();
    const client = new OAuth2Client(clientId, clientSecret);
    client.setCredentials({ refresh_token: credential.refreshToken });
    return client;
  }

  private credentialPath(accountLabel: string): string {
    return join(this.google.credentialsDir, `${accountLabel}.json`);
  }
}

const required = (name: string, value: string | undefined): string => {
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
};
