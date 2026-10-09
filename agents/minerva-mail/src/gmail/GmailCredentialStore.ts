import { Inject, Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { gmailConfig, type GmailConfigType } from "../config/configuration";

/** A linked mailbox's credential, as stored. Never logged, never returned. */
export type GmailCredential = {
  /** The mailbox's address, lower case: the file's name. */
  email: string;
  /** Google's subject for the account: a re-authorization must return it. */
  subject: string;
  refreshToken: string;
  scope: string;
  obtainedAt: string;
};

/**
 * Linked mailboxes' refresh tokens, one file per mailbox in
 * MAIL_CREDENTIALS_DIR (as the calendar agent keeps its): the directory
 * 0700, each file 0600, written whole under a temporary name and renamed.
 */
@Injectable()
export class GmailCredentialStore {
  constructor(
    @Inject(gmailConfig.KEY) private readonly config: GmailConfigType,
  ) {}

  private get dir(): string {
    return this.config.credentialsDir ?? "data/credentials";
  }

  private file(email: string): string {
    return path.join(
      this.dir,
      `${encodeURIComponent(email.toLowerCase())}.json`,
    );
  }

  load(email: string): GmailCredential | undefined {
    try {
      return JSON.parse(fs.readFileSync(this.file(email), "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  save(credential: GmailCredential): void {
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    const target = this.file(credential.email);
    const partial = `${target}.partial`;
    fs.writeFileSync(partial, JSON.stringify(credential), { mode: 0o600 });
    fs.renameSync(partial, target);
  }

  /** Whether there was one to remove. */
  remove(email: string): boolean {
    try {
      fs.unlinkSync(this.file(email));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }

  list(): GmailCredential[] {
    if (!fs.existsSync(this.dir)) return [];
    return fs
      .readdirSync(this.dir)
      .filter((name) => name.endsWith(".json"))
      .map((name) =>
        JSON.parse(fs.readFileSync(path.join(this.dir, name), "utf8")),
      )
      .sort((a: GmailCredential, b: GmailCredential) =>
        a.email.localeCompare(b.email),
      );
  }
}
