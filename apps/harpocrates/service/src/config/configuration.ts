import {
  ConfigValidationError,
  EnvReader,
  readLoggingConfig,
  readRuntimeConfig,
  type LoggingConfig,
  type RuntimeConfig,
} from "@ncfritz/olympus-nest";
import { registerAs, type ConfigType } from "@nestjs/config";

export { ConfigValidationError };

export type ServerConfig = RuntimeConfig & {
  /** Serve the OpenAPI document at /api-spec (ENABLE_API_EXPLORER; always outside production). */
  apiExplorer: boolean;
};

export type DatabaseConfig = {
  /**
   * harpocrates-postgres (ADR 0020, Data): DATABASE_URL, or the file
   * DATABASE_URL_FILE names (a secret: the URL carries the password).
   */
  url: string;
};

export type SignerConfig = {
  /** The signer's Unix socket (ADR 0020): its only transport. */
  socketPath: string;
  /** The shared token, a file secret. */
  tokenFile: string;
};

export type AuthConfig = {
  /**
   * Where the API publishes its signing keys (ADR 0018): users' access
   * tokens are verified against them. One of the URL and a local file.
   */
  jwksUrl?: string;
  jwksFile?: string;
  audience: string;
  /** How recent a sign-in escrow export and ceremonies need, in seconds. */
  recentSignInSeconds: number;
  /**
   * The CA console's sign-in through Olympus (ADR 0029, 0032); unset
   * without OLYMPUS_API_URL, when only Bearer tokens are taken.
   */
  console?: ConsoleSignInConfig;
};

export type ConsoleSignInConfig = {
  /**
   * Where the browser reaches this service (AUTH_BASE_URL); the sign-in
   * completes at `<baseUrl>/auth/callback`, which the API's
   * AUTH_CONSOLE_BASE_URLS names for harpocrates-ca-console.
   */
  baseUrl: string;
  /** The console's own URL (WEB_APP_URL): the cookies' path, CORS, and the only allowed returnTo. */
  webAppUrl?: string;
  olympus: {
    /** Where this service reaches the Olympus API (OLYMPUS_API_URL). */
    apiUrl: string;
    /** Where a browser reaches it to sign in (OLYMPUS_SIGN_IN_URL); the API's URL by default. */
    signInUrl: string;
  };
};

export type PkiConfig = {
  /** Written into CA names: `<realm> <purpose> <tier> CA <n> - G<g>`. */
  realm: string;
  organization: string;
  /** Where lists and CA certificates are published (ADR 0020, Distribution). */
  distributionUrl: string;
  /**
   * The directory the distribution host serves (the
   * `harpocrates-published` volume): `crl/<slug>.crl`, `ca/<slug>.crt`.
   */
  publishedDir: string;
};

export type CrlConfig = {
  /** How long an online CA's list is valid (ADR 0020: 7 days). */
  validityHours: number;
  /** How often an online CA's list is re-signed with nothing revoked (daily). */
  refreshHours: number;
  /** How long an offline CA's list, signed in a ceremony, is valid (13 months). */
  offlineValidityDays: number;
  /** How often the scheduler runs, in seconds; 0 turns it off (the CLI, tests). */
  scheduleSeconds: number;
};

/** The renewal listener (ADR 0020, Renewal and delivery). */
export type RenewalConfig = {
  /** Its port (9443); 0 turns it off. */
  port: number;
  /**
   * Where it keeps its own key and certificate, which it issues itself
   * from the TLS CA and renews at two-thirds of their life.
   */
  tlsDir: string;
  /** The names it is reached by: its certificate's CN and DNS names. */
  hostnames: string[];
  /** The profile its own certificate is issued under. */
  profileId: string;
};

export type DeployConfig = {
  /**
   * Where host-path targets are written, a directory per target: mounted
   * here read-write and read-only into the web server, which reloads when
   * a target's `deployed` file changes.
   */
  dir: string;
  /**
   * How often deploy targets are checked: renewals followed, certificates
   * renewed when due, failed deployments retried. 0 turns it off.
   */
  scheduleSeconds: number;
};

export type HarpocratesConfig = {
  server: ServerConfig;
  logging: LoggingConfig;
  database: DatabaseConfig;
  signer: SignerConfig;
  auth: AuthConfig;
  pki: PkiConfig;
  crl: CrlConfig;
  renewal: RenewalConfig;
  deploy: DeployConfig;
};

const integer = (
  read: EnvReader,
  name: string,
  fallback: number,
  minimum = 1,
) => {
  const raw = read.optional(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum) {
    read.problems.push(
      minimum === 1
        ? `${name} must be a positive integer, got "${raw}"`
        : `${name} must be an integer of at least ${minimum}, got "${raw}"`,
    );
    return fallback;
  }
  return value;
};

const withoutTrailingSlash = (url: string) => url.replace(/\/+$/, "");

/** The console's sign-in: configured by OLYMPUS_API_URL, absent without it. */
const readConsoleSignIn = (
  read: EnvReader,
  port: number,
): ConsoleSignInConfig | undefined => {
  const apiUrl = read.optional("OLYMPUS_API_URL");
  if (apiUrl === undefined) return undefined;
  for (const [name, value] of [
    ["OLYMPUS_API_URL", apiUrl],
    ["OLYMPUS_SIGN_IN_URL", read.optional("OLYMPUS_SIGN_IN_URL")],
    ["AUTH_BASE_URL", read.optional("AUTH_BASE_URL")],
    ["WEB_APP_URL", read.optional("WEB_APP_URL")],
  ] as const) {
    if (value === undefined) continue;
    try {
      new URL(value);
    } catch {
      read.problems.push(`${name} must be a URL, got "${value}"`);
    }
  }
  return {
    baseUrl: withoutTrailingSlash(
      read.string("AUTH_BASE_URL", `http://localhost:${port}`),
    ),
    webAppUrl: read.optional("WEB_APP_URL"),
    olympus: {
      apiUrl: withoutTrailingSlash(apiUrl),
      signInUrl: withoutTrailingSlash(
        read.optional("OLYMPUS_SIGN_IN_URL") ?? apiUrl,
      ),
    },
  };
};

/**
 * The service's configuration from environment variables (see
 * dev.env.example).
 * @throws ConfigValidationError listing every invalid or missing variable
 */
export const readConfig = (
  env: Record<string, string | undefined>,
): HarpocratesConfig => {
  const read = new EnvReader(env);
  const runtime = readRuntimeConfig(read, "harpocrates", 3200);
  const auth: AuthConfig = {
    jwksUrl: read.optional("AUTH_JWKS_URL"),
    jwksFile: read.optional("AUTH_JWKS_FILE"),
    audience: read.string("AUTH_AUDIENCE", "olympus-api"),
    recentSignInSeconds: integer(read, "AUTH_RECENT_SIGN_IN_SECONDS", 300),
    console: readConsoleSignIn(read, runtime.port),
  };
  if (!auth.jwksUrl === !auth.jwksFile) {
    read.problems.push("set exactly one of AUTH_JWKS_URL and AUTH_JWKS_FILE");
  }
  const config: HarpocratesConfig = {
    server: {
      ...runtime,
      apiExplorer:
        read.boolean("ENABLE_API_EXPLORER", false) || !runtime.isProduction,
    },
    logging: readLoggingConfig(read, runtime.isProduction),
    database: { url: read.string("DATABASE_URL") },
    signer: {
      socketPath: read.string("SIGNER_SOCKET_PATH"),
      tokenFile: read.string("SIGNER_TOKEN_FILE"),
    },
    auth,
    pki: {
      realm: read.string("PKI_REALM", "ncfritz.net"),
      organization: read.string("PKI_ORGANIZATION", "ncfritz.net"),
      distributionUrl: read
        .string("PKI_DISTRIBUTION_URL", "http://pki.internal.ncfritz.net")
        .replace(/\/+$/, ""),
      publishedDir: read.string("PKI_PUBLISHED_DIR"),
    },
    crl: {
      validityHours: integer(read, "CRL_VALIDITY_HOURS", 7 * 24),
      refreshHours: integer(read, "CRL_REFRESH_HOURS", 24),
      offlineValidityDays: integer(read, "CRL_OFFLINE_VALIDITY_DAYS", 395),
      scheduleSeconds: integer(read, "CRL_SCHEDULE_SECONDS", 30, 0),
    },
    renewal: {
      port: integer(read, "RENEWAL_LISTEN_PORT", 9443, 0),
      tlsDir: read.string(
        "RENEWAL_TLS_DIR",
        "/var/lib/harpocrates/renewal-tls",
      ),
      hostnames: read.list("RENEWAL_HOSTNAMES", ["pki.internal.ncfritz.net"]),
      profileId: read.string("RENEWAL_TLS_PROFILE", "internal-tls"),
    },
    deploy: {
      dir: read.string("DEPLOY_DIR", "/srv/harpocrates/deployed"),
      scheduleSeconds: integer(read, "DEPLOY_SCHEDULE_SECONDS", 60, 0),
    },
  };
  if (config.renewal.port > 65535) {
    read.problems.push("RENEWAL_LISTEN_PORT must be a port number");
  }
  if (config.renewal.hostnames.length === 0) {
    read.problems.push("RENEWAL_HOSTNAMES must name at least one host");
  }
  if (config.crl.refreshHours >= config.crl.validityHours) {
    read.problems.push(
      "CRL_REFRESH_HOURS must be less than CRL_VALIDITY_HOURS: a list must be replaced before it expires",
    );
  }
  if (read.problems.length) throw new ConfigValidationError(read.problems);
  return config;
};

/*
 * Typed configuration namespaces. Inject one with
 * `@Inject(serverConfig.KEY) server: ServerConfigType`.
 */
export const serverConfig = registerAs(
  "server",
  () => readConfig(process.env).server,
);
export const loggingConfig = registerAs(
  "logging",
  () => readConfig(process.env).logging,
);
export const databaseConfig = registerAs(
  "database",
  () => readConfig(process.env).database,
);
export const signerConfig = registerAs(
  "signer",
  () => readConfig(process.env).signer,
);
export const authConfig = registerAs(
  "auth",
  () => readConfig(process.env).auth,
);
export const pkiConfig = registerAs("pki", () => readConfig(process.env).pki);
export const crlConfig = registerAs("crl", () => readConfig(process.env).crl);
export const renewalConfig = registerAs(
  "renewal",
  () => readConfig(process.env).renewal,
);

export const deployConfig = registerAs(
  "deploy",
  () => readConfig(process.env).deploy,
);

export type ServerConfigType = ConfigType<typeof serverConfig>;
export type LoggingConfigType = ConfigType<typeof loggingConfig>;
export type DatabaseConfigType = ConfigType<typeof databaseConfig>;
export type SignerConfigType = ConfigType<typeof signerConfig>;
export type AuthConfigType = ConfigType<typeof authConfig>;
export type PkiConfigType = ConfigType<typeof pkiConfig>;
export type CrlConfigType = ConfigType<typeof crlConfig>;
export type RenewalConfigType = ConfigType<typeof renewalConfig>;
export type DeployConfigType = ConfigType<typeof deployConfig>;

export const ALL_CONFIG = [
  serverConfig,
  loggingConfig,
  databaseConfig,
  signerConfig,
  authConfig,
  pkiConfig,
  crlConfig,
  renewalConfig,
  deployConfig,
];
