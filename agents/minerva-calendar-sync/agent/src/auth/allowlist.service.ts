import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/** Admin-supplied allowlist of identities permitted to log into the app, by verified email. */
@Injectable()
export class AllowlistService {
  private readonly emails: Set<string>;

  constructor(config: ConfigService) {
    const raw = config.get<string>("AUTH_ALLOWED_EMAILS") ?? "";
    this.emails = new Set(
      raw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  isAllowed(email: string): boolean {
    return this.emails.has(email.toLowerCase());
  }
}
