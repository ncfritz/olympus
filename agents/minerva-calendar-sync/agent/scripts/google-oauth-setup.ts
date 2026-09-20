/**
 * One-time interactive Google OAuth consent flow for a single account label.
 *
 * Usage:
 *   pnpm google:auth -- --label personal-gmail
 *
 * Requires GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET in the
 * environment (dev.env, see dev.env.example) — from a Google Cloud "Desktop
 * app" OAuth client. Writes the resulting refresh token to
 * GOOGLE_CREDENTIALS_DIR/<label>.json (default .credentials/, gitignored).
 */
import { readConfig } from "../src/config/configuration";
import { GoogleCredentialStore } from "../src/providers/google/GoogleCredentialStore";
import {
  createLoopbackClient,
  waitForAuthorizationCode,
} from "../src/providers/google/googleLoopbackAuth";
import { GOOGLE_CALENDAR_SCOPES } from "../src/providers/google/googleOauthScopes";

async function main(): Promise<void> {
  const label = parseLabelArg();
  const credentials = new GoogleCredentialStore(readConfig(process.env).google);
  const { clientId, clientSecret } = credentials.oauthClient();

  const { client, redirectUri } = await createLoopbackClient(
    clientId,
    clientSecret,
  );
  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_CALENDAR_SCOPES,
  });

  console.log(
    "\nOpen this URL in a browser and sign in with the Google account to sync:\n",
  );
  console.log(authUrl);
  console.log(`\nWaiting for the OAuth redirect on ${redirectUri} ...\n`);

  const code = await waitForAuthorizationCode(redirectUri);
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh_token. If you've authorized this app before, revoke " +
        "access at https://myaccount.google.com/permissions and run this script again.",
    );
  }

  credentials.save({
    accountLabel: label,
    refreshToken: tokens.refresh_token,
    scope: tokens.scope ?? GOOGLE_CALENDAR_SCOPES.join(" "),
    obtainedAt: new Date().toISOString(),
  });

  console.log(`Saved credentials for "${label}"`);
}

function parseLabelArg(): string {
  const index = process.argv.indexOf("--label");
  const label = index >= 0 ? process.argv[index + 1] : undefined;
  if (!label) {
    throw new Error("Usage: pnpm google:auth -- --label <account-label>");
  }
  return label;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
