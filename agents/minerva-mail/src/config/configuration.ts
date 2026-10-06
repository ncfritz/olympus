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
 * arrives with phase 1b.
 */
/**
 * The classifier's services listener (agents/minerva-mail-ml), which the
 * agent sends text to with its own certificate (ADR 0030). Unset, nothing
 * that sends text can run.
 */
export type ClassifierConfig = {
  /** Including the version: https://minerva-mail-ml:3107/v1 */
  baseUrl: string;
  tls?: { certificate: string; key: string; ca?: string };
  timeoutMs: number;
};

export type AgentConfig = {
  runtime: RuntimeConfig;
  amqp: AmqpConfig;
  logging: LoggingConfig;
  olympus: ApiClientConfig;
  classifier?: ClassifierConfig;
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
  const config: AgentConfig = {
    runtime,
    amqp: readAmqpConfig(read, "/dionysus-dev"),
    logging: readLoggingConfig(read, runtime.isProduction),
    olympus,
    ...(classifier ? { classifier } : {}),
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

export type RuntimeConfigType = ConfigType<typeof runtimeConfig>;
export type AmqpConfigType = ConfigType<typeof amqpConfig>;
export type OlympusConfigType = ConfigType<typeof olympusConfig>;
export type ClassifierConfigType = ConfigType<typeof classifierConfig>;

export const ALL_CONFIG = [
  runtimeConfig,
  amqpConfig,
  olympusConfig,
  classifierConfig,
];
