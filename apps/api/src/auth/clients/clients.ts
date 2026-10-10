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
  /** Paths joined to each origin the site is served on, e.g. `/auth/callback`. */
  originPaths?: string[];
  /**
   * Paths joined to each URL this console's service is published at (ADR
   * 0029): the service, not the browser, completes a console's sign-in,
   * under its own published path. Only this client's URLs: one console's
   * client never accepts another's callback.
   */
  consolePaths?: string[];
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
    // The Minerva calendar console (ADR 0029). Its agent is the client: it
    // keeps the refresh token in an httpOnly cookie of its own, on the
    // console's origin, which is why the API hands it over in the body.
    id: "minerva-calendar-console",
    refreshToken: "body",
    consolePaths: ["/auth/callback"],
  },
  {
    // Harpocrates's CA console (ADR 0032), the same way: its service
    // completes the sign-in and keeps the refresh token in a cookie.
    id: "harpocrates-ca-console",
    refreshToken: "body",
    consolePaths: ["/auth/callback"],
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

/** Where this environment publishes the clients that have a URL. */
export type ClientOrigins = {
  /**
   * Where the site is served: `https://olympus.internal.ncfritz.net` and
   * `https://olympus.ncfritz.net` in production (AUTH_CLIENT_ORIGINS).
   */
  site: string[];
  /**
   * Where each console's service is published, path and all, by client id:
   * `minerva-calendar-console` at
   * `https://control.olympus.ncfritz.net/minerva/calendar/api` in
   * production (AUTH_CONSOLE_BASE_URLS).
   */
  console: Record<string, string[]>;
};

/**
 * The clients, with where this environment publishes them. Those are
 * configuration because they differ per environment; which paths under
 * them are allowed is not.
 */
export const resolveClients = (
  origins: ClientOrigins,
  definitions: ClientDefinition[] = CLIENTS,
): Map<string, Client> => {
  const join = (base: string, path: string): string =>
    `${base.replace(/\/+$/, "")}${path}`;
  const clients = definitions.map((definition) => {
    const exact = new Set<string>(definition.uris ?? []);
    for (const origin of origins.site) {
      for (const path of definition.originPaths ?? []) {
        exact.add(join(origin, path));
      }
    }
    for (const base of origins.console[definition.id] ?? []) {
      for (const path of definition.consolePaths ?? []) {
        exact.add(join(base, path));
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
