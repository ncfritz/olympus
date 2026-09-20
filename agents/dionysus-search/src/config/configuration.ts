import {
  AmqpConfig,
  ConfigValidationError,
  EnvReader,
  LoggingConfig,
  readAmqpConfig,
  readLoggingConfig,
  readRuntimeConfig,
  RuntimeConfig,
} from "@ncfritz/olympus-nest";
import { ConfigType, registerAs } from "@nestjs/config";

export { ConfigValidationError };

export type OlympusConfig = {
  /** Base URL for SDK calls, including `/v1`. */
  apiBaseUrl: string;
};

export type NzbGeekConfig = {
  /** The indexer's newznab API endpoint. */
  apiUrl: string;
  /** Unset fails every indexer search. */
  apiKey?: string;
};

export type AgentConfig = {
  runtime: RuntimeConfig;
  amqp: AmqpConfig;
  logging: LoggingConfig;
  olympus: OlympusConfig;
  nzbGeek: NzbGeekConfig;
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
  const runtime = readRuntimeConfig(read, "dionysus-search-agent", 3100);
  const config: AgentConfig = {
    runtime,
    amqp: readAmqpConfig(read, "/dionysus-dev"),
    logging: readLoggingConfig(read, runtime.isProduction),
    olympus: {
      apiBaseUrl: read.string("API_BASE_URL", "http://localhost:3001/v1"),
    },
    nzbGeek: {
      apiUrl: read.string("NZBGEEK_API_URL", "https://api.nzbgeek.info/api"),
      apiKey: read.optional("NZBGEEK_API_KEY"),
    },
  };
  if (read.problems.length) throw new ConfigValidationError(read.problems);
  return config;
};

/*
 * Typed configuration namespaces. Inject one with
 * `@Inject(nzbGeekConfig.KEY) nzbGeek: NzbGeekConfigType`.
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
export const nzbGeekConfig = registerAs(
  "nzbGeek",
  () => readConfig(process.env).nzbGeek,
);

export type RuntimeConfigType = ConfigType<typeof runtimeConfig>;
export type AmqpConfigType = ConfigType<typeof amqpConfig>;
export type OlympusConfigType = ConfigType<typeof olympusConfig>;
export type NzbGeekConfigType = ConfigType<typeof nzbGeekConfig>;

export const ALL_CONFIG = [
  runtimeConfig,
  amqpConfig,
  olympusConfig,
  nzbGeekConfig,
];
