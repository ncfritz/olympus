import { createServer } from "http";
import { AddressInfo } from "net";

/**
 * Finds a free ephemeral port on 127.0.0.1 — the redirect a "Desktop app" /
 * public-client OAuth registration accepts without pre-registering it, per
 * RFC 8252. Shared by every provider's loopback-redirect OAuth flow (one-time
 * CLI setup scripts and the Sync page's in-app connect/reauth flow alike).
 */
export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const port = (probe.address() as AddressInfo).port;
      probe.close(() => resolve(port));
    });
    probe.on("error", reject);
  });
}

/**
 * Waits for the OAuth redirect to hit `redirectUri`, resolving with the full
 * callback URL (or rejecting on an `error` query param or `timeoutMs`
 * elapsing with neither `code` nor `error`). Callers that need more than the
 * bare `code` — e.g. openid-client's authorizationCodeGrant, which validates
 * `state` against the whole callback URL — use this directly;
 * `waitForAuthorizationCode` below is the simpler `code`-only shorthand.
 */
export function waitForAuthorizationCallback(redirectUri: string, timeoutMs?: number): Promise<URL> {
  const port = Number(new URL(redirectUri).port);

  return new Promise((resolve, reject) => {
    const timer = timeoutMs
      ? setTimeout(() => {
          server.close();
          reject(new Error(`Timed out waiting for the OAuth redirect on ${redirectUri}`));
        }, timeoutMs)
      : undefined;

    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", redirectUri);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      res.setHeader("Content-Type", "text/html");
      if (error) {
        res.end(`<html><body>Authorization failed: ${error}. You can close this window.</body></html>`);
        clearTimeout(timer);
        server.close();
        reject(new Error(`Authorization server returned an error: ${error}`));
        return;
      }
      if (!code) {
        res.end("<html><body>Waiting for authorization...</body></html>");
        return;
      }

      res.end("<html><body>Authorized — you can close this window and return to Minerva.</body></html>");
      clearTimeout(timer);
      server.close();
      resolve(url);
    });

    server.listen(port, "127.0.0.1");
    server.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

/** Shorthand for callers that only need the `code` query param (e.g. google-auth-library's own `getToken`). */
export async function waitForAuthorizationCode(redirectUri: string, timeoutMs?: number): Promise<string> {
  const url = await waitForAuthorizationCallback(redirectUri, timeoutMs);
  const code = url.searchParams.get("code");
  if (!code) {
    throw new Error(`OAuth redirect on ${redirectUri} carried no "code" param`);
  }
  return code;
}
