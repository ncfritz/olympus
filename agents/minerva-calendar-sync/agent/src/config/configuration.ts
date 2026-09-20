import {
  ConfigValidationError,
  EnvReader,
  readAmqpConfig,
  readLoggingConfig,
  readRuntimeConfig,
  type AmqpConfig,
  type LoggingConfig,
  type RuntimeConfig,
} from "@ncfritz/olympus-nest";
import { registerAs, type ConfigType } from "@nestjs/config";
import { join } from "path";
import {
  parseOidcProviders,
  type OidcProviderConfig,
} from "../auth/oidcProviderConfig";

export { ConfigValidationError };

export type ServerConfig = RuntimeConfig;

export type GoogleConfig = {
  /** From a Google Cloud "Desktop app" OAuth client; needed to connect or sync a Google account. */
  clientId?: string;
  clientSecret?: string;
  /** Where the connected accounts' refresh tokens are stored (one JSON file each). */
  credentialsDir: string;
};

export type MicrosoftConfig = {
  /** From an Entra ID "Mobile and desktop applications" registration (a public client: no secret). */
  clientId?: string;
  tenantId: string;
  credentialsDir: string;
};

export type SyncConfig = {
  pollIntervalMs: number;
  windowPastDays: number;
  windowFutureDays: number;
  historyRetentionDays: number;
  /** Public HTTPS origin the providers post push notifications to; unset means polling only. */
  webhookBaseUrl?: string;
};

export type OutboxConfig = {
  /** false: no event changes are recorded for publishing and no RabbitMQ connection is attempted. */
  enabled: boolean;
  amqp: AmqpConfig;
  batchSize: number;
  pollIntervalMs: number;
  maxAttempts: number;
};

export type AuthConfig = {
  jwtSecret: string;
  /** Where the agent is reachable; the OIDC redirect URIs are built from it. */
  baseUrl: string;
  oidcProviders: OidcProviderConfig[];
  allowedEmails: string[];
  /** The console's origin: CORS and the only allowed login returnTo. */
  webAppUrl?: string;
};

export type AgentConfig = {
  server: ServerConfig;
  logging: LoggingConfig;
  google: GoogleConfig;
  microsoft: MicrosoftConfig;
  sync: SyncConfig;
  outbox: OutboxConfig;
  auth: AuthConfig;
};

/** The agent's directory (dist/config → ../..), where .credentials* live by default. */
const AGENT_ROOT = join(__dirname, "..", "..");

const positiveInt = (read: EnvReader, name: string, fallback: number) => {
  const raw = read.optional(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    read.problems.push(`${name} must be a positive integer, got "${raw}"`);
    return fallback;
  }
  return value;
};

const oidcProviders = (read: EnvReader): OidcProviderConfig[] => {
  const raw = read.optional("AUTH_OIDC_PROVIDERS");
  if (!raw) return [];
  try {
    return parseOidcProviders(raw);
  } catch (e) {
    read.problems.push(e instanceof Error ? e.message : String(e));
    return [];
  }
};

/**
 * The agent's configuration from environment variables (see
 * dev.env.example). DATABASE_URL is read by Prisma itself.
 * @throws ConfigValidationError listing every invalid or missing variable
 */
export const readConfig = (
  env: Record<string, string | undefined>,
): AgentConfig => {
  const read = new EnvReader(env);
  const server = readRuntimeConfig(read, "minerva-calendar-sync", 4432);
  const config: AgentConfig = {
    server,
    logging: readLoggingConfig(read, server.isProduction),
    google: {
      clientId: read.optional("GOOGLE_OAUTH_CLIENT_ID"),
      clientSecret: read.optional("GOOGLE_OAUTH_CLIENT_SECRET"),
      credentialsDir: read.string(
        "GOOGLE_CREDENTIALS_DIR",
        join(AGENT_ROOT, ".credentials"),
      ),
    },
    microsoft: {
      clientId: read.optional("MICROSOFT_OAUTH_CLIENT_ID"),
      tenantId: read.string("MICROSOFT_OAUTH_TENANT_ID", "common"),
      credentialsDir: read.string(
        "MICROSOFT_CREDENTIALS_DIR",
        join(AGENT_ROOT, ".credentials-microsoft"),
      ),
    },
    sync: {
      pollIntervalMs: positiveInt(read, "POLL_INTERVAL_MS", 45_000),
      windowPastDays: positiveInt(read, "SYNC_WINDOW_PAST_DAYS", 30),
      windowFutureDays: positiveInt(read, "SYNC_WINDOW_FUTURE_DAYS", 180),
      historyRetentionDays: positiveInt(
        read,
        "SYNC_HISTORY_RETENTION_DAYS",
        90,
      ),
      webhookBaseUrl: read.optional("WEBHOOK_BASE_URL"),
    },
    outbox: {
      enabled: read.boolean("OUTBOX_ENABLED", false),
      amqp: readAmqpConfig(read, "/"),
      batchSize: positiveInt(read, "OUTBOX_BATCH_SIZE", 50),
      pollIntervalMs: positiveInt(read, "OUTBOX_POLL_INTERVAL_MS", 5_000),
      maxAttempts: positiveInt(read, "OUTBOX_MAX_ATTEMPTS", 10),
    },
    auth: {
      jwtSecret: read.string("AUTH_JWT_SECRET"),
      baseUrl: read.string("AUTH_BASE_URL", `http://localhost:${server.port}`),
      oidcProviders: oidcProviders(read),
      allowedEmails: read
        .list("AUTH_ALLOWED_EMAILS", [])
        .map((email) => email.toLowerCase()),
      webAppUrl: read.optional("WEB_APP_URL"),
    },
  };
  if (read.problems.length) throw new ConfigValidationError(read.problems);
  return config;
};

/*
 * Typed configuration namespaces. Inject one with
 * `@Inject(syncConfig.KEY) sync: SyncConfigType`.
 */
export const serverConfig = registerAs(
  "server",
  () => readConfig(process.env).server,
);
export const loggingConfig = registerAs(
  "logging",
  () => readConfig(process.env).logging,
);
export const googleConfig = registerAs(
  "google",
  () => readConfig(process.env).google,
);
export const microsoftConfig = registerAs(
  "microsoft",
  () => readConfig(process.env).microsoft,
);
export const syncConfig = registerAs(
  "sync",
  () => readConfig(process.env).sync,
);
export const outboxConfig = registerAs(
  "outbox",
  () => readConfig(process.env).outbox,
);
export const authConfig = registerAs(
  "auth",
  () => readConfig(process.env).auth,
);

export type ServerConfigType = ConfigType<typeof serverConfig>;
export type LoggingConfigType = ConfigType<typeof loggingConfig>;
export type GoogleConfigType = ConfigType<typeof googleConfig>;
export type MicrosoftConfigType = ConfigType<typeof microsoftConfig>;
export type SyncConfigType = ConfigType<typeof syncConfig>;
export type OutboxConfigType = ConfigType<typeof outboxConfig>;
export type AuthConfigType = ConfigType<typeof authConfig>;

export const ALL_CONFIG = [
  serverConfig,
  loggingConfig,
  googleConfig,
  microsoftConfig,
  syncConfig,
  outboxConfig,
  authConfig,
];
