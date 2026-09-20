import { Inject, Injectable } from "@nestjs/common";
import { authConfig, type AuthConfigType } from "../../config/configuration";

/** Admin-supplied allowlist of identities permitted to log into the app, by verified email. */
@Injectable()
export class AllowlistService {
  private readonly emails: Set<string>;

  constructor(@Inject(authConfig.KEY) auth: AuthConfigType) {
    this.emails = new Set(auth.allowedEmails);
  }

  isAllowed(email: string): boolean {
    return this.emails.has(email.toLowerCase());
  }
}
