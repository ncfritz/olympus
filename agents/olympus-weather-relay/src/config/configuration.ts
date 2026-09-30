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

export type RelayConfig = {
  /**
   * The database this relay feeds, which names its queue (ADR 0025): relays
   * feeding one database share a queue, each line reaching one of them; a
   * relay for another database gets its own queue and every line.
   */
  database: string;
};

export type AgentConfig = {
  runtime: RuntimeConfig;
  amqp: AmqpConfig;
  logging: LoggingConfig;
  olympus: ApiClientConfig;
  relay: RelayConfig;
};

const DATABASE = /^[a-z0-9_-]{1,63}$/;

/**
 * The agent's configuration from environment variables (see
 * dev.env.example).
 * @throws ConfigValidationError listing every invalid or missing variable
 */
export const readConfig = (
  env: Record<string, string | undefined>,
): AgentConfig => {
  const read = new EnvReader(env);
  const runtime = readRuntimeConfig(read, "olympus-weather-relay-agent", 3102);
  const database = read.string("WEATHER_RELAY_DATABASE", "olympus_dev");
  if (!DATABASE.test(database)) {
    read.problems.push(
      `WEATHER_RELAY_DATABASE is lower case letters, digits, _ and -, got "${database}"`,
    );
  }
  const config: AgentConfig = {
    runtime,
    // Dev's vhost: prod's lines arrive there by the broker's shovel.
    amqp: readAmqpConfig(read, "/dionysus-dev"),
    logging: readLoggingConfig(read, runtime.isProduction),
    olympus: readApiClientConfig(read, "http://localhost:3100/v1"),
    relay: { database },
  };
  if (read.problems.length) throw new ConfigValidationError(read.problems);
  return config;
};

/*
 * Typed configuration namespaces. Inject one with
 * `@Inject(relayConfig.KEY) relay: RelayConfigType`.
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
export const relayConfig = registerAs(
  "relay",
  () => readConfig(process.env).relay,
);

export type RuntimeConfigType = ConfigType<typeof runtimeConfig>;
export type AmqpConfigType = ConfigType<typeof amqpConfig>;
export type OlympusConfigType = ConfigType<typeof olympusConfig>;
export type RelayConfigType = ConfigType<typeof relayConfig>;

export const ALL_CONFIG = [
  runtimeConfig,
  amqpConfig,
  olympusConfig,
  relayConfig,
];
