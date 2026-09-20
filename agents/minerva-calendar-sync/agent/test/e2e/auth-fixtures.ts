import { INestApplication } from "@nestjs/common";
import { AuthTokenService } from "../../src/auth/auth-token.service";

/** Must match the AUTH_ALLOWED_EMAILS entry set in env-setup.ts. */
export const E2E_ALLOWED_EMAIL = "e2e@example.com";

/** Mints a valid access token the same way a real login would — no network/IdP needed for tests that don't exercise the OIDC dance itself. */
export function issueE2eAccessToken(
  app: INestApplication,
  email = E2E_ALLOWED_EMAIL,
): string {
  return app.get(AuthTokenService).issueAccessToken(email);
}
