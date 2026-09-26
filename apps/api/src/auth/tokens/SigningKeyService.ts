import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import * as fs from "fs";
import { authConfig, type AuthConfigType } from "../../config/configuration";
import { loadSigningKeys, type SigningKeys } from "./signingKeys";

/**
 * Holds the access-token signing keys, read once at start (ADR 0018).
 *
 * The keys are read from the filesystem rather than the database, and never
 * reloaded: rotation is dropping a PEM in and restarting, which makes the
 * set a request is verified against a fixed, inspectable thing rather than
 * something that can change under a request.
 *
 * Unset `AUTH_SIGNING_KEYS` leaves this empty, and signing in is then
 * unavailable rather than broken — which is how every environment behaves
 * until phase 3 is deployed.
 */
@Injectable()
export class SigningKeyService implements OnModuleInit {
  private readonly logger = new Logger(SigningKeyService.name);
  private keys?: SigningKeys;

  constructor(@Inject(authConfig.KEY) private readonly auth: AuthConfigType) {}

  async onModuleInit(): Promise<void> {
    const directory = this.auth.users.signingKeys;
    if (directory === undefined) {
      this.logger.log("AUTH_SIGNING_KEYS is unset: no tokens will be issued");
      return;
    }
    // An empty directory is the same situation as an unset one — signing in
    // is not configured — and it is what a host has before anyone has run
    // scripts/signing-keys.sh. Treating it as a failure would take the whole
    // API down over one feature, which is the wrong blast radius: every
    // endpoint would stop because nobody can sign in.
    //
    // A directory that does not exist still throws, from readdirSync: that
    // is a wrong path rather than an unconfigured one, and it should be loud.
    if (!fs.readdirSync(directory).some((name) => name.endsWith(".pem"))) {
      this.logger.warn(
        `${directory} holds no .pem: no tokens will be issued (scripts/signing-keys.sh)`,
      );
      return;
    }
    this.keys = await loadSigningKeys(directory);
    // Which key signs comes from filename order, which nothing enforces, so
    // it is worth saying out loud at every start.
    this.logger.log(
      `signing with ${this.keys.signer.source} (kid ${this.keys.signer.kid}); ` +
        `${this.keys.byKid.size} key(s) verify`,
    );
  }

  /** The keys, or undefined where signing in is not configured. */
  available(): SigningKeys | undefined {
    return this.keys;
  }

  /** The keys, or a failure: for a path that cannot proceed without them. */
  require(): SigningKeys {
    if (this.keys === undefined) {
      throw new Error("AUTH_SIGNING_KEYS is not configured");
    }
    return this.keys;
  }
}
