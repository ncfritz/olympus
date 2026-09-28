import * as fs from "fs";
import * as path from "path";
import type { SavedTokens } from "@ncfritz/olympus-auth-flow";
import { TesterError } from "./errors";

/**
 * The tokens on disk.
 *
 * A file, mode 600, in a mode-700 directory: a refresh token is a credential
 * that lives for weeks, and the tester is run on a laptop that has other
 * accounts on it. Nothing here prints a token -- `whoami` prints claims,
 * which are not secret -- so the file is the only place one exists.
 */
export class TokenStore {
  constructor(readonly location: string) {}

  read(): SavedTokens | undefined {
    let contents: string;
    try {
      contents = fs.readFileSync(this.location, "utf8");
    } catch (error: unknown) {
      if ((error as { code?: string }).code === "ENOENT") return undefined;
      throw error;
    }
    try {
      return JSON.parse(contents) as SavedTokens;
    } catch {
      throw new TesterError(
        `${this.location} is not readable as JSON; delete it and sign in again`,
      );
    }
  }

  /** The tokens, or a sentence saying to sign in. */
  require(): SavedTokens {
    const saved = this.read();
    if (saved === undefined) {
      throw new TesterError(`not signed in (no ${this.location}): run login`);
    }
    return saved;
  }

  save(tokens: SavedTokens): void {
    fs.mkdirSync(path.dirname(this.location), { recursive: true, mode: 0o700 });
    fs.writeFileSync(this.location, `${JSON.stringify(tokens, null, 2)}\n`, {
      mode: 0o600,
    });
    // `mode` above applies only when the file is created, and an existing
    // file keeps whatever it had -- including a mode from before this was
    // careful about it.
    fs.chmodSync(this.location, 0o600);
  }

  clear(): void {
    try {
      fs.rmSync(this.location);
    } catch (error: unknown) {
      if ((error as { code?: string }).code !== "ENOENT") throw error;
    }
  }
}
