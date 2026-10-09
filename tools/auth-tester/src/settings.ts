import * as os from "os";
import * as path from "path";
import { type Flags, optional } from "./args";
import { TesterError } from "./errors";

/**
 * The client this tester is registered as (`apps/api/src/auth/clients`). It
 * receives its refresh token in the body and may redirect to any port on
 * loopback, which is what a native client needs and what a browser must not
 * have.
 */
export const CLIENT_ID = "olympus-auth-tester";

/** The path the loopback listener answers on, and part of the registration. */
export const REDIRECT_PATH = "/callback";

export type Settings = {
  apiBaseUrl: string;
  servicesBaseUrl: string;
  clientId: string;
  provider: string;
  redirectPath: string;
  /** 0 asks the operating system for a free one. */
  port: number;
  tokensPath: string;
  /** Send the stored access token even when it has expired. */
  stale: boolean;
};

export const SETTINGS_FLAGS = {
  value: ["api", "provider", "port", "tokens"],
  boolean: ["external", "stale"],
} as const;

const DEFAULT_API = "http://localhost:3001/v1";
const DEFAULT_SERVICES_API = "https://localhost:3443/v1";

/**
 * Where the tester is pointed, from the environment and the flags.
 *
 * `--external` is a separate variable rather than a different default,
 * because the two runs it exists for are the same commands against two
 * fronts: the workspace API in phase 4, the border in phase 6. Naming the URL
 * once in the environment and choosing it with a flag is what keeps a
 * sign-off run from depending on somebody remembering which port dev was on.
 */
export const resolveSettings = (
  env: NodeJS.ProcessEnv,
  flags: Flags,
): Settings => {
  const external = flags.external === true;
  const asked = optional(flags, "api");
  if (external && asked !== undefined) {
    throw new TesterError("--external and --api name two different APIs");
  }
  const apiBaseUrl = external
    ? requireEnv(env, "OLYMPUS_EXTERNAL_API_BASE_URL")
    : (asked ?? env.OLYMPUS_API_BASE_URL ?? DEFAULT_API);

  const port = optional(flags, "port");
  if (port !== undefined && !/^\d+$/.test(port)) {
    throw new TesterError("--port must be a number");
  }

  return {
    apiBaseUrl: versioned(apiBaseUrl, "the API"),
    servicesBaseUrl: versioned(
      env.OLYMPUS_SERVICES_BASE_URL ?? DEFAULT_SERVICES_API,
      "the services listener",
    ),
    clientId: CLIENT_ID,
    provider: optional(flags, "provider") ?? "google",
    redirectPath: REDIRECT_PATH,
    port: port === undefined ? 0 : Number(port),
    tokensPath:
      optional(flags, "tokens") ??
      env.OLYMPUS_AUTH_TESTER_TOKENS ??
      path.join(os.homedir(), ".olympus", "auth-tester.json"),
    stale: flags.stale === true,
  };
};

const requireEnv = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = env[name];
  if (value === undefined || value === "") {
    throw new TesterError(
      `${name} is not set, so there is no external API to call`,
    );
  }
  return value;
};

/**
 * A base URL including the version, as every Olympus client takes it. Without
 * the version every call is a 404 from the router rather than an error that
 * says so, which is ten minutes of looking at the wrong thing.
 */
const versioned = (baseUrl: string, what: string): string => {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new TesterError(`${baseUrl} is not a URL`);
  }
  // `localhost:3001/v1` parses: "localhost:" is read as the scheme and the
  // rest as a path, so a URL with the scheme left off passes every other
  // check here and fails later as something that looks like the API's fault.
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TesterError(
      `${baseUrl} has no http:// or https:// in front of it`,
    );
  }
  if (!/\/v\d+$/.test(url.pathname.replace(/\/+$/, ""))) {
    throw new TesterError(
      `the base URL for ${what} includes the version: ${url.origin}${url.pathname.replace(/\/+$/, "")}/v1`,
    );
  }
  return baseUrl.replace(/\/+$/, "");
};
