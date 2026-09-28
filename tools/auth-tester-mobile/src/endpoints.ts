/**
 * Which API the tester is pointed at.
 *
 * `localhost` means the phone on a phone, so every target here is a name or an
 * address something else answers on. The three named ones are the environments
 * this deployment serves; the custom one is a laptop on the LAN.
 */
export type NamedTarget = "production" | "internal" | "dev";

/**
 * Where the API answers, which is not the same everywhere: an API run from the
 * workspace serves `/v1` itself, and the `/api` in front of it is nginx's,
 * added by whatever publishes it. Pointing at a laptop with `/api/v1` gets a
 * 404 from the router, and pointing at a front door with `/v1` gets one from
 * nginx -- neither says which mistake it was, so it is a choice rather than a
 * guess.
 */
export type ApiPath = "/v1" | "/api/v1";

export type Target =
  | { kind: "named"; name: NamedTarget }
  | {
      kind: "custom";
      protocol: "http" | "https";
      /** A host name or an address, optionally with `:port`. */
      host: string;
      port?: string;
      /** Absent in settings stored before this was a choice: `/v1` then. */
      path?: ApiPath;
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
 * What the named front doors publish: nginx takes `/api` off and the API adds
 * it back to its Location headers from `X-Forwarded-Prefix`.
 */
export const API_PATH: ApiPath = "/api/v1";

/** What an API serves when nothing is in front of it: `pnpm dev` on a laptop. */
export const DIRECT_PATH: ApiPath = "/v1";

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

  const baseUrl = `${target.protocol}://${host}${port === "" ? "" : `:${port}`}${target.path ?? DIRECT_PATH}`;
  if (target.protocol === "http" && !LOCAL.test(host)) {
    return {
      baseUrl,
      warning: `iOS refuses cleartext to ${host}: NSAllowsLocalNetworking covers the local network only.`,
    };
  }
  return { baseUrl };
};

/**
 * Just the base URL, or nothing.
 *
 * A primitive on purpose: a screen that derives its dependencies from a
 * property of an object cannot be memoized by the React Compiler, which will
 * not assume the object is never mutated -- so it skips the component whole.
 * `resolve` is still there for the problem and the warning.
 */
export const baseUrlOf = (target: Target): string | undefined => {
  const answer = resolve(target);
  return "baseUrl" in answer ? answer.baseUrl : undefined;
};

/**
 * The services listener (ADR 0018): a second port, with its own certificate,
 * that authenticates a caller by the one it presents.
 */
export const SERVICES_PORT = "3443";

/**
 * Where the services listener answers on the machine a custom target names.
 *
 * Only for a custom target: the named front doors are nginx, which terminates
 * TLS -- a client certificate presented there reaches nginx and stops, so the
 * only way to exercise the border is to talk to the listener directly. Always
 * `https`, since a cleartext port could not ask for a certificate at all.
 */
export const servicesUrlFor = (target: Target): string | undefined => {
  if (target.kind === "named") return undefined;
  const host = (target.host.trim().split(":")[0] ?? "").toLowerCase();
  if (host === "" || !HOST.test(host)) return undefined;
  return `https://${host}:${SERVICES_PORT}${DIRECT_PATH}`;
};

export const isResolved = (answer: Resolved | Unresolved): answer is Resolved =>
  "baseUrl" in answer;

/** What to show as the target's name, in a line. */
export const describe = (target: Target): string =>
  target.kind === "named"
    ? NAMED[target.name].label
    : `${target.protocol}://${target.host}${target.port ? `:${target.port}` : ""}${
        target.path ?? DIRECT_PATH
      }`;
