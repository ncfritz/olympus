/**
 * Which API the tester is pointed at.
 *
 * `localhost` means the phone on a phone, so every target here is a name or an
 * address something else answers on. The three named ones are the environments
 * this deployment serves; the custom one is a laptop on the LAN.
 */
export type NamedTarget = "production" | "internal" | "dev";

export type Target =
  | { kind: "named"; name: NamedTarget }
  | {
      kind: "custom";
      protocol: "http" | "https";
      /** A host name or an address, optionally with `:port`. */
      host: string;
      port?: string;
    };

export const NAMED: Record<
  NamedTarget,
  { label: string; host: string; note: string }
> = {
  production: {
    label: "Production",
    host: "olympus.ncfritz.net",
    note: "the canonical AUTH_PUBLIC_BASE_URL",
  },
  internal: {
    label: "Internal",
    host: "olympus.internal.ncfritz.net",
    note: "the same server block as production: one API, two names",
  },
  dev: {
    label: "Dev",
    host: "olympus.dev.ncfritz.net",
    note: "prod's nginx, proxied to a dev-host running pnpm dev",
  },
};

/**
 * The path the API is published under, with the version every Olympus client
 * carries. nginx serves it at `/api` and the API adds it back to Location
 * headers from `X-Forwarded-Prefix`, so this is one string, not two decisions.
 */
export const API_PATH = "/api/v1";

export const DEFAULT_TARGET: Target = { kind: "named", name: "dev" };

export type Resolved = {
  baseUrl: string;
  /** Something that will work but is worth knowing about. */
  warning?: string;
};

export type Unresolved = { problem: string };

const HOST = /^[A-Za-z0-9.-]+$/;

/**
 * Addresses iOS will talk to over cleartext once `NSAllowsLocalNetworking` is
 * set: the local network, and nothing else. A public host over `http://` is
 * refused by App Transport Security before the request leaves, which looks
 * like the server being down.
 */
const LOCAL =
  /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|.+\.local)$/;

/** The base URL a target means, or the reason it does not mean one yet. */
export const resolve = (target: Target): Resolved | Unresolved => {
  if (target.kind === "named") {
    return { baseUrl: `https://${NAMED[target.name].host}${API_PATH}` };
  }

  // Typing a host on a phone keyboard, `192.168.1.10:3001` is what comes out,
  // so take the port from whichever field it arrived in.
  const [typedHost, ...rest] = target.host.trim().split(":");
  const host = (typedHost ?? "").toLowerCase();
  const port = (rest[0] ?? target.port ?? "").trim();

  if (host === "") return { problem: "a host or address is needed" };
  if (rest.length > 1)
    return { problem: `${target.host} has more than one port` };
  if (!HOST.test(host)) {
    return { problem: `${host} is not a host name or an address` };
  }
  if (port !== "" && !/^\d+$/.test(port)) {
    return { problem: `${port} is not a port` };
  }
  if (port !== "" && (Number(port) < 1 || Number(port) > 65535)) {
    return { problem: `${port} is not a port between 1 and 65535` };
  }

  const baseUrl = `${target.protocol}://${host}${port === "" ? "" : `:${port}`}${API_PATH}`;
  if (target.protocol === "http" && !LOCAL.test(host)) {
    return {
      baseUrl,
      warning: `iOS refuses cleartext to ${host}: NSAllowsLocalNetworking covers the local network only.`,
    };
  }
  return { baseUrl };
};

export const isResolved = (answer: Resolved | Unresolved): answer is Resolved =>
  "baseUrl" in answer;

/** What to show as the target's name, in a line. */
export const describe = (target: Target): string =>
  target.kind === "named"
    ? NAMED[target.name].label
    : `${target.protocol}://${target.host}${target.port ? `:${target.port}` : ""}`;
