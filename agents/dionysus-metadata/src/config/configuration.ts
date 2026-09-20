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

export type TmdbConfig = {
  /** TMDB API read access token; unset fails every TMDB call. */
  apiKey?: string;
};

export type CacheConfig = {
  /** Directory of the SQLite metadata fetch job cache (jobCache.db). */
  path: string;
};

export type AgentConfig = {
  runtime: RuntimeConfig;
  amqp: AmqpConfig;
  logging: LoggingConfig;
  olympus: OlympusConfig;
  tmdb: TmdbConfig;
  cache: CacheConfig;
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
  const runtime = readRuntimeConfig(read, "dionysus-metadata-agent", 3100);
  const config: AgentConfig = {
    runtime,
    amqp: readAmqpConfig(read, "/dionysus-dev"),
    logging: readLoggingConfig(read, runtime.isProduction),
    olympus: {
      apiBaseUrl: read.string("API_BASE_URL", "http://localhost:3001/v1"),
    },
    tmdb: {
      apiKey: read.optional("TMDB_API_KEY"),
    },
    cache: {
      path: read.string("DIONYSUS_CACHE_PATH", "./cache"),
    },
  };
  if (read.problems.length) throw new ConfigValidationError(read.problems);
  return config;
};

/*
 * Typed configuration namespaces. Inject one with
 * `@Inject(tmdbConfig.KEY) tmdb: TmdbConfigType`.
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
export const tmdbConfig = registerAs(
  "tmdb",
  () => readConfig(process.env).tmdb,
);
export const cacheConfig = registerAs(
  "cache",
  () => readConfig(process.env).cache,
);

export type RuntimeConfigType = ConfigType<typeof runtimeConfig>;
export type AmqpConfigType = ConfigType<typeof amqpConfig>;
export type OlympusConfigType = ConfigType<typeof olympusConfig>;
export type TmdbConfigType = ConfigType<typeof tmdbConfig>;
export type CacheConfigType = ConfigType<typeof cacheConfig>;

export const ALL_CONFIG = [
  runtimeConfig,
  amqpConfig,
  olympusConfig,
  tmdbConfig,
  cacheConfig,
];
