/**
 * The clients that may ask for tokens (ADR 0018). Configuration, not the
 * database: adding one is a deploy, which is the point — an attacker who
 * reaches the database cannot invent a client.
 *
 * Every client is public (no secret) and uses the authorization-code flow
 * with PKCE, so what protects the exchange is the redirect URI matching
 * exactly. "Exactly" is the whole security property here, which is why
 * matching is spelled out per client rather than pattern-matched.
 */

/** How a client receives its refresh token. */
export type RefreshDelivery =
  /** httpOnly cookie, scoped to the auth path: the browser. */
  | "cookie"
  /** In the response body, for a client with somewhere safe to put it. */
  | "body";

export type ClientDefinition = {
  id: string;
  refreshToken: RefreshDelivery;
  /** Paths joined to each configured origin, e.g. `/auth/callback`. */
  originPaths?: string[];
  /** Whole URIs that do not depend on an origin: a custom scheme. */
  uris?: string[];
  /**
   * RFC 8252 loopback redirect: `http://127.0.0.1:<any port><path>`. A
   * native client cannot reserve a port, so the port is what varies — and
   * only for loopback, where nobody else can be listening on the user's
   * behalf.
   */
  loopbackPath?: string;
};

export const CLIENTS: ClientDefinition[] = [
  {
    id: "olympus-site",
    refreshToken: "cookie",
    originPaths: ["/auth/callback"],
  },
  {
    id: "olympus-ios",
    refreshToken: "body",
    uris: ["olympus://auth"],
  },
  {
    id: "olympus-auth-tester",
    refreshToken: "body",
    uris: ["olympus-auth-tester://auth"],
    loopbackPath: "/callback",
  },
];

export type Client = {
  id: string;
  refreshToken: RefreshDelivery;
  /** Whether this exact redirect URI is one the client registered. */
  accepts(redirectUri: string): boolean;
};

// `URL.hostname` keeps the brackets for IPv6, and `localhost` is not here
// on purpose: it resolves through whatever the machine's resolver says.
const LOOPBACK = new Set(["127.0.0.1", "[::1]"]);

const isLoopback = (url: URL, path: string): boolean =>
  url.protocol === "http:" &&
  LOOPBACK.has(url.hostname) &&
  url.pathname === path &&
  url.search === "" &&
  url.hash === "";

/**
 * The clients, with the origins this environment serves the site on —
 * `https://olympus.internal.ncfritz.net` and `https://olympus.ncfritz.net`
 * in production. The origins are configuration because they differ per
 * environment; which paths under them are allowed is not.
 */
export const resolveClients = (
  origins: string[],
  definitions: ClientDefinition[] = CLIENTS,
): Map<string, Client> => {
  const clients = definitions.map((definition) => {
    const exact = new Set<string>(definition.uris ?? []);
    for (const origin of origins) {
      for (const path of definition.originPaths ?? []) {
        exact.add(`${origin.replace(/\/+$/, "")}${path}`);
      }
    }
    return [
      definition.id,
      {
        id: definition.id,
        refreshToken: definition.refreshToken,
        accepts(redirectUri: string): boolean {
          if (exact.has(redirectUri)) return true;
          if (definition.loopbackPath === undefined) return false;
          try {
            return isLoopback(new URL(redirectUri), definition.loopbackPath);
          } catch {
            return false;
          }
        },
      } satisfies Client,
    ] as const;
  });
  return new Map(clients);
};
