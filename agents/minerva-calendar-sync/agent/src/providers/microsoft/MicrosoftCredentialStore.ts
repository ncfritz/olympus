import { Inject, Injectable } from "@nestjs/common";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import {
  microsoftConfig,
  type MicrosoftConfigType,
} from "../../config/configuration";

export interface StoredMicrosoftCredential {
  accountLabel: string;
  refreshToken: string;
  scope: string;
  obtainedAt: string;
}

/**
 * Connected Microsoft accounts' refresh tokens, one JSON file per account in
 * MICROSOFT_CREDENTIALS_DIR (default agent/.credentials-microsoft); see
 * GoogleCredentialStore.
 */
@Injectable()
export class MicrosoftCredentialStore {
  constructor(
    @Inject(microsoftConfig.KEY)
    private readonly microsoft: MicrosoftConfigType,
  ) {}

  save(credential: StoredMicrosoftCredential): void {
    mkdirSync(this.microsoft.credentialsDir, { recursive: true });
    writeFileSync(
      this.credentialPath(credential.accountLabel),
      JSON.stringify(credential, null, 2),
    );
  }

  /** Returns undefined instead of throwing when nothing has been stored yet for this account. */
  tryLoad(accountLabel: string): StoredMicrosoftCredential | undefined {
    const path = this.credentialPath(accountLabel);
    if (!existsSync(path)) return undefined;
    return JSON.parse(readFileSync(path, "utf8")) as StoredMicrosoftCredential;
  }

  load(accountLabel: string): StoredMicrosoftCredential {
    const credential = this.tryLoad(accountLabel);
    if (!credential) {
      throw new Error(
        `No stored Microsoft credential for "${accountLabel}" at ${this.credentialPath(accountLabel)}.`,
      );
    }
    return credential;
  }

  /**
   * Every account label with a stored credential, whether or not it's used by
   * any configured calendar — e.g. a just-authorized account that hasn't had
   * a calendar added to it yet still needs to show up as "connected".
   */
  listAccountLabels(): string[] {
    if (!existsSync(this.microsoft.credentialsDir)) return [];
    return readdirSync(this.microsoft.credentialsDir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.slice(0, -".json".length));
  }

  private credentialPath(accountLabel: string): string {
    return join(this.microsoft.credentialsDir, `${accountLabel}.json`);
  }
}
