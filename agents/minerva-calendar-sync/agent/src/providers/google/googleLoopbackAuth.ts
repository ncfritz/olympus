import { OAuth2Client } from "google-auth-library";
import { findFreePort } from "../shared/oauthLoopbackServer";

export { waitForAuthorizationCode } from "../shared/oauthLoopbackServer";

export interface LoopbackClient {
  client: OAuth2Client;
  redirectUri: string;
}

/**
 * Builds an OAuth2Client bound to a fresh loopback redirect URI (an
 * ephemeral port on 127.0.0.1) — the redirect Google accepts for "Desktop
 * app" OAuth clients without pre-registering it, per RFC 8252. Shared by the
 * one-time CLI setup script and the Sync page's in-app reauth flow.
 */
export async function createLoopbackClient(
  clientId: string,
  clientSecret: string,
): Promise<LoopbackClient> {
  const port = await findFreePort();
  const redirectUri = `http://127.0.0.1:${port}`;
  return {
    client: new OAuth2Client(clientId, clientSecret, redirectUri),
    redirectUri,
  };
}
