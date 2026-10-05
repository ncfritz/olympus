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
 * 1a (the Takeout import publishes metadata and imports the account);
 * Gmail's OAuth client arrives with phase 1b.
 */
export type AgentConfig = {
  runtime: RuntimeConfig;
  amqp: AmqpConfig;
  logging: LoggingConfig;
  olympus: ApiClientConfig;
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
  const config: AgentConfig = {
    runtime,
    amqp: readAmqpConfig(read, "/dionysus-dev"),
    logging: readLoggingConfig(read, runtime.isProduction),
    olympus: readApiClientConfig(read, "http://localhost:3100/v1"),
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

export type RuntimeConfigType = ConfigType<typeof runtimeConfig>;
export type AmqpConfigType = ConfigType<typeof amqpConfig>;
export type OlympusConfigType = ConfigType<typeof olympusConfig>;

export const ALL_CONFIG = [runtimeConfig, amqpConfig, olympusConfig];
