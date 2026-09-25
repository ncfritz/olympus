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

export type HarpocratesConfig = {
  server: ServerConfig;
  logging: LoggingConfig;
  signer: SignerConfig;
  auth: AuthConfig;
  pki: PkiConfig;
  crl: CrlConfig;
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

/**
 * The service's configuration from environment variables (see
 * dev.env.example). DATABASE_URL is read by Prisma itself.
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
  };
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

export type ServerConfigType = ConfigType<typeof serverConfig>;
export type LoggingConfigType = ConfigType<typeof loggingConfig>;
export type SignerConfigType = ConfigType<typeof signerConfig>;
export type AuthConfigType = ConfigType<typeof authConfig>;
export type PkiConfigType = ConfigType<typeof pkiConfig>;
export type CrlConfigType = ConfigType<typeof crlConfig>;

export const ALL_CONFIG = [
  serverConfig,
  loggingConfig,
  signerConfig,
  authConfig,
  pkiConfig,
  crlConfig,
];
