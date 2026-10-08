import {
  AmqpConfig,
  ApiClientConfig,
  ConfigValidationError,
  EnvReader,
  LoggingConfig,
  readAmqpConfig,
  readApiClientConfig,
  readLoggingConfig,
  readRuntimeConfig,
  RuntimeConfig,
} from "@ncfritz/olympus-nest";
import { ConfigType, registerAs } from "@nestjs/config";

export { ConfigValidationError };

/*
 * docs/plans/email-management: the broker and the API client from phase
 * 1a (the Takeout import publishes metadata and imports the account); the
 * classifier from phase 3 (featurizing sends it text); Gmail's OAuth client
 * and the services listener the API links accounts through, phase 1b.
 */
/**
 * The classifier's services listener (agents/minerva-mail-ml), which the
 * agent sends text to with its own certificate (ADR 0030). Unset, nothing
 * that sends text can run.
 */
export type ClassifierConfig = {
  /** Including the version: https://minerva-mail-agent-ml:3107/v1 */
  baseUrl: string;
  tls?: { certificate: string; key: string; ca?: string };
  timeoutMs: number;
};

/**
 * Gmail's OAuth client (ADR 0030): a Web application client of its own, in
 * the calendar agent's Google project, on its Internal consent screen. The
 * agent holds the secret and the refresh tokens; the API never sees them.
 */
export type GmailConfig = {
  clientId: string;
  clientSecret: string;
  /** One file per linked mailbox, holding its refresh token. */
  credentialsDir: string;
  /** What a new sign-in asks for. */
  scopes: string[];
  /** Seconds between history polls of each linked mailbox; 0 turns it off. */
  pollSeconds: number;
  /**
   * Whether label changes may be written to Gmail (phase 4): sign-ins then
   * ask for gmail.modify, and the API's batches are written.
   */
  writesEnabled: boolean;
  /**
   * Whether Gmail filters may be made (phase 7): sign-ins then ask for
   * gmail.settings.basic too.
   */
  filtersEnabled: boolean;
};

/** The scopes until the first phase that writes (ADR 0030). */
export const GMAIL_READ_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
];

/** What label changes need (ADR 0030): nothing is ever deleted. */
export const GMAIL_MODIFY_SCOPE =
  "https://www.googleapis.com/auth/gmail.modify";

/** The scopes once writes are on (phase 4). */
export const GMAIL_WRITE_SCOPES = [...GMAIL_READ_SCOPES, GMAIL_MODIFY_SCOPE];

/** What making filters needs (phase 7): the mailbox's basic settings. */
export const GMAIL_SETTINGS_SCOPE =
  "https://www.googleapis.com/auth/gmail.settings.basic";

/**
 * The services listener (ADR 0028's, for this agent): its management API
 * over HTTPS, for the Olympus API, which identifies itself with a client
 * certificate from the services chain.
 */
export type ServicesListenerConfig = {
  port: number;
  certificate: string;
  key: string;
  ca: string;
  revocationLists: string[];
  /** The issuer's common name a client certificate must have (ADR 0023). */
  issuer?: string;
  /** The common names allowed to call: the Olympus API. */
  clients: string[];
};

export type AgentConfig = {
  runtime: RuntimeConfig;
  amqp: AmqpConfig;
  logging: LoggingConfig;
  olympus: ApiClientConfig;
  classifier?: ClassifierConfig;
  gmail?: GmailConfig;
  services?: ServicesListenerConfig;
};

/**
 * MAIL_GOOGLE_OAUTH_CLIENT_ID and MAIL_GOOGLE_OAUTH_CLIENT_SECRET (or
 * _SECRET_FILE), together or not at all; MAIL_CREDENTIALS_DIR; and
 * MAIL_GMAIL_POLL_SECONDS, 60 unless set (0: no polling); and
 * MAIL_WRITES_ENABLED and MAIL_FILTERS_ENABLED, false unless set.
 */
const readGmailConfig = (read: EnvReader): GmailConfig | undefined => {
  const clientId = read.optional("MAIL_GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = read.optional("MAIL_GOOGLE_OAUTH_CLIENT_SECRET");
  const credentialsDir = read.string(
    "MAIL_CREDENTIALS_DIR",
    "data/credentials",
  );
  if (!clientId && !clientSecret) return undefined;
  if (!clientId || !clientSecret) {
    read.problems.push(
      "MAIL_GOOGLE_OAUTH_CLIENT_ID and MAIL_GOOGLE_OAUTH_CLIENT_SECRET (or _SECRET_FILE) are set together or not at all",
    );
    return undefined;
  }
  const poll = read.string("MAIL_GMAIL_POLL_SECONDS", "60");
  const pollSeconds = Number(poll);
  if (!/^[0-9]{1,5}$/.test(poll) || (pollSeconds > 0 && pollSeconds < 10)) {
    read.problems.push(
      "MAIL_GMAIL_POLL_SECONDS must be 0 (no polling) or a whole number of seconds, 10 or more",
    );
  }
  const writesEnabled = read.boolean("MAIL_WRITES_ENABLED", false);
  const filtersEnabled = read.boolean("MAIL_FILTERS_ENABLED", false);
  return {
    clientId,
    clientSecret,
    credentialsDir,
    scopes: [
      ...(writesEnabled ? GMAIL_WRITE_SCOPES : GMAIL_READ_SCOPES),
      ...(filtersEnabled ? [GMAIL_SETTINGS_SCOPE] : []),
    ],
    pollSeconds,
    writesEnabled,
    filtersEnabled,
  };
};

/**
 * The same variables as the API's and the calendar agent's services
 * listeners: SERVICES_LISTEN_PORT, TLS_CERT, TLS_KEY, TLS_CA_SERVICES,
 * TLS_CRL_SERVICES and AUTH_SERVICES_ISSUER; and AUTH_SERVICE_CLIENTS, the
 * callers allowed.
 */
const readServicesListener = (
  read: EnvReader,
): ServicesListenerConfig | undefined => {
  const certificate = read.optional("TLS_CERT");
  const key = read.optional("TLS_KEY");
  const ca = read.optional("TLS_CA_SERVICES");
  const port = read.port("SERVICES_LISTEN_PORT", 4435);
  const revocationLists = read.list("TLS_CRL_SERVICES", []);
  const issuer = read.optional("AUTH_SERVICES_ISSUER");
  const clients = read.list("AUTH_SERVICE_CLIENTS", ["olympus-api"]);
  if (!certificate && !key && !ca) return undefined;
  if (!certificate || !key || !ca) {
    read.problems.push(
      "TLS_CERT, TLS_KEY and TLS_CA_SERVICES are set together or not at all",
    );
    return undefined;
  }
  return {
    port,
    certificate,
    key,
    ca,
    revocationLists,
    ...(issuer ? { issuer } : {}),
    clients,
  };
};

/**
 * MAIL_ML_URL, and the certificate it is called with: MAIL_ML_CLIENT_CERT
 * and MAIL_ML_CLIENT_KEY (and the optional MAIL_ML_CA_CERT), defaulting to
 * the API's, which are this agent's own.
 */
const readClassifierConfig = (
  read: EnvReader,
  olympus: ApiClientConfig,
): ClassifierConfig | undefined => {
  const baseUrl = read.optional("MAIL_ML_URL");
  if (!baseUrl) return undefined;
  const certificate =
    read.optional("MAIL_ML_CLIENT_CERT") ?? olympus.tls?.certificate;
  const key = read.optional("MAIL_ML_CLIENT_KEY") ?? olympus.tls?.key;
  const ca = read.optional("MAIL_ML_CA_CERT") ?? olympus.tls?.ca;
  const rawTimeout = read.string("MAIL_ML_TIMEOUT_MS", "60000");
  const timeoutMs = Number(rawTimeout);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    read.problems.push(
      `MAIL_ML_TIMEOUT_MS must be a whole number of milliseconds, got "${rawTimeout}"`,
    );
  }
  if (!baseUrl.startsWith("https:")) {
    read.problems.push(
      "MAIL_ML_URL must be https: the classifier takes text only over mutual TLS",
    );
  }
  if (!certificate || !key) {
    read.problems.push(
      "MAIL_ML_URL needs a client certificate: MAIL_ML_CLIENT_CERT and MAIL_ML_CLIENT_KEY, or API_CLIENT_CERT and API_CLIENT_KEY",
    );
    return { baseUrl, timeoutMs };
  }
  return { baseUrl, tls: { certificate, key, ca }, timeoutMs };
};

/**
 * The agent's configuration from environment variables (see
 * dev.env.example).
 * @throws ConfigValidationError listing every invalid or missing variable
 */
export const readConfig = (
  env: Record<string, string | undefined>,
): AgentConfig => {
  const read = new EnvReader(env);
  const runtime = readRuntimeConfig(read, "minerva-mail-agent", 3105);
  const olympus = readApiClientConfig(read, "http://localhost:3100/v1");
  const classifier = readClassifierConfig(read, olympus);
  const gmail = readGmailConfig(read);
  const services = readServicesListener(read);
  const config: AgentConfig = {
    runtime,
    amqp: readAmqpConfig(read, "/dionysus-dev"),
    logging: readLoggingConfig(read, runtime.isProduction),
    olympus,
    ...(classifier ? { classifier } : {}),
    ...(gmail ? { gmail } : {}),
    ...(services ? { services } : {}),
  };
  if (read.problems.length) throw new ConfigValidationError(read.problems);
  return config;
};

/** Validates the whole environment up front, for a command's bootstrap. */
export const validateEnvironment = (): AgentConfig => readConfig(process.env);

/*
 * Typed configuration namespaces. Inject one with
 * `@Inject(runtimeConfig.KEY) runtime: RuntimeConfigType`.
 */
export const runtimeConfig = registerAs(
  "runtime",
  () => readConfig(process.env).runtime,
);
export const amqpConfig = registerAs(
  "amqp",
  () => readConfig(process.env).amqp,
);
export const olympusConfig = registerAs(
  "olympus",
  () => readConfig(process.env).olympus,
);
// Empty when the classifier is not configured (a namespace cannot be
// undefined); ClassifierClient then refuses to send.
export const classifierConfig = registerAs(
  "classifier",
  (): Partial<ClassifierConfig> => readConfig(process.env).classifier ?? {},
);

// Empty when Gmail's client is not configured; linking then answers 503.
export const gmailConfig = registerAs(
  "gmail",
  (): Partial<GmailConfig> => readConfig(process.env).gmail ?? {},
);
export const servicesConfig = registerAs(
  "services",
  (): Partial<ServicesListenerConfig> => readConfig(process.env).services ?? {},
);

export type RuntimeConfigType = ConfigType<typeof runtimeConfig>;
export type AmqpConfigType = ConfigType<typeof amqpConfig>;
export type OlympusConfigType = ConfigType<typeof olympusConfig>;
export type ClassifierConfigType = ConfigType<typeof classifierConfig>;
export type GmailConfigType = ConfigType<typeof gmailConfig>;
export type ServicesConfigType = ConfigType<typeof servicesConfig>;

export const ALL_CONFIG = [
  runtimeConfig,
  amqpConfig,
  olympusConfig,
  classifierConfig,
  gmailConfig,
  servicesConfig,
];
