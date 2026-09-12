/**
 * One-time interactive Google OAuth consent flow for a single account label.
 *
 * Usage:
 *   pnpm google:auth -- --label personal-gmail
 *
 * Requires GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET in the
 * environment (see .env.example) — from a Google Cloud "Desktop app" OAuth
 * client. Writes the resulting refresh token to
 * .credentials/<label>.json (gitignored).
 */
import "dotenv/config";
import { OAuth2Client } from "google-auth-library";
import { createServer } from "http";
import { AddressInfo } from "net";
import { saveGoogleCredential, requireEnv } from "../src/providers/google/google-credential-store";

const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

async function main(): Promise<void> {
  const label = parseLabelArg();

  const { client, redirectUri } = await createLoopbackClient();
  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });

  console.log("\nOpen this URL in a browser and sign in with the Google account to sync:\n");
  console.log(authUrl);
  console.log(`\nWaiting for the OAuth redirect on ${redirectUri} ...\n`);

  const code = await waitForAuthorizationCode(client, redirectUri);
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh_token. If you've authorized this app before, revoke " +
        "access at https://myaccount.google.com/permissions and run this script again.",
    );
  }

  saveGoogleCredential({
    accountLabel: label,
    refreshToken: tokens.refresh_token,
    scope: tokens.scope ?? SCOPES.join(" "),
    obtainedAt: new Date().toISOString(),
  });

  console.log(`Saved credentials for "${label}" to .credentials/${label}.json`);
}

function parseLabelArg(): string {
  const index = process.argv.indexOf("--label");
  const label = index >= 0 ? process.argv[index + 1] : undefined;
  if (!label) {
    throw new Error("Usage: pnpm google:auth -- --label <account-label>");
  }
  return label;
}

async function createLoopbackClient(): Promise<{ client: OAuth2Client; redirectUri: string }> {
  const port = await findFreePort();
  const redirectUri = `http://127.0.0.1:${port}`;
  const client = new OAuth2Client(
    requireEnv("GOOGLE_OAUTH_CLIENT_ID"),
    requireEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
    redirectUri,
  );
  return { client, redirectUri };
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const port = (probe.address() as AddressInfo).port;
      probe.close(() => resolve(port));
    });
    probe.on("error", reject);
  });
}

function waitForAuthorizationCode(client: OAuth2Client, redirectUri: string): Promise<string> {
  const port = Number(new URL(redirectUri).port);

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", redirectUri);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      res.setHeader("Content-Type", "text/html");
      if (error) {
        res.end(`<html><body>Authorization failed: ${error}. You can close this window.</body></html>`);
        server.close();
        reject(new Error(`Google returned an error: ${error}`));
        return;
      }
      if (!code) {
        res.end("<html><body>Waiting for authorization...</body></html>");
        return;
      }

      res.end("<html><body>Authorized — you can close this window and return to the terminal.</body></html>");
      server.close();
      resolve(code);
    });

    server.listen(port, "127.0.0.1");
    server.on("error", reject);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
