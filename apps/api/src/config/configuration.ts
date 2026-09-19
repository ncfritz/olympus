import { ConfigType, registerAs } from "@nestjs/config";
import { EnvReader } from "./EnvReader";

const LOG_LEVELS = [
  "error",
  "warn",
  "info",
  "http",
  "verbose",
  "debug",
  "silly",
] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export type ServerConfig = {
  /** NODE_ENV (development when unset). */
  nodeEnv: string;
  isProduction: boolean;
  /** Service name in logs and metrics labels. */
  appName: string;
  port: number;
  /** Serve the OpenAPI explorer (always outside production). */
  apiExplorer: boolean;
  corsOrigins: string[];
};

export type HasuraConfig = {
  host: string;
  /** GraphQL endpoint, e.g. http://localhost:8080/v1/graphql */
  endpoint: string;
  adminSecret: string;
};

export type AmqpConfig = {
  host: string;
  uri: string;
  /** `uri` with the password masked, for logs. */
  redactedUri: string;
};

export type LoggingConfig = {
  level: LogLevel;
  console: { enabled: boolean; level: LogLevel };
  loki: { url?: string; level: LogLevel };
  file: { enabled: boolean; level: LogLevel; path: string };
};

export type DionysusConfig = {
  /** Where uploaded content assets are written. */
  uploadPath: string;
  /** The same directory as the ingest agents see it. */
  publishPath: string;
};

export type AppConfig = {
  server: ServerConfig;
  hasura: HasuraConfig;
  amqp: AmqpConfig;
  logging: LoggingConfig;
  dionysus: DionysusConfig;
};

export class ConfigValidationError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid configuration:\n  - ${problems.join("\n  - ")}`);
    this.name = "ConfigValidationError";
  }
}

/**
 * The API configuration from environment variables (see dev.env.example).
 * @throws ConfigValidationError listing every invalid or missing variable
 */
export const readConfig = (
  env: Record<string, string | undefined>,
): AppConfig => {
  const read = new EnvReader(env);

  const nodeEnv = read.string("NODE_ENV", "development");
  const isProduction = nodeEnv === "production";

  const server: ServerConfig = {
    nodeEnv,
    isProduction,
    appName: read.string(
      "APP_NAME",
      `olympus-api${isProduction ? "" : `-${nodeEnv}`}`,
    ),
    port: read.port("LISTEN_PORT", 3100),
    apiExplorer: read.boolean("ENABLE_API_EXPLORER", false) || !isProduction,
    corsOrigins: read.list("CORS_ORIGINS", ["http://localhost:3000"]),
  };

  const hasuraProtocol = read.oneOf(
    "HASURA_PROTOCOL",
    ["http", "https"],
    "http",
  );
  const hasuraHost = read.string("HASURA_HOST", "localhost");
  const hasuraPort = read.port("HASURA_PORT", 8080);
  const hasura: HasuraConfig = {
    host: hasuraHost,
    endpoint: `${hasuraProtocol}://${hasuraHost}:${hasuraPort}/v1/graphql`,
    adminSecret: read.string("HASURA_PASSWORD", ""),
  };

  const amqpProtocol = read.oneOf("AMQP_PROTOCOL", ["amqp", "amqps"], "amqp");
  const amqpHost = read.string("AMQP_HOST", "localhost");
  const amqpPort = read.port("AMQP_PORT", 5672);
  const amqpUser = read.string("AMQP_USER", "admin");
  const amqpPassword = read.string("AMQP_PASSWORD", "admin");
  const amqpVhost = encodeURIComponent(read.string("AMQP_VHOST", "/dionysus"));
  const amqpAddress = `${amqpHost}:${amqpPort}/${amqpVhost}`;
  const amqp: AmqpConfig = {
    host: amqpHost,
    uri: `${amqpProtocol}://${amqpUser}:${amqpPassword}@${amqpAddress}`,
    redactedUri: `${amqpProtocol}://${amqpUser}:***@${amqpAddress}`,
  };

  const level = (name: string, fallback: LogLevel) =>
    read.oneOf(name, LOG_LEVELS, fallback);
  const logging: LoggingConfig = {
    level: level("LOKI_LEVEL", "debug"),
    console: {
      enabled: read.boolean("ENABLE_CONSOLE_LOGGING", false) || !isProduction,
      level: level("CONSOLE_LOGGING_LEVEL", "info"),
    },
    loki: {
      url: read.optional("LOKI_URL"),
      level: level("LOKI_LOGGING_LEVEL", "info"),
    },
    file: {
      enabled: read.boolean("FILE_LOGGING_ENABLED", false) || isProduction,
      level: level("FILE_LOGGING_LEVEL", "info"),
      path: read.string("FILE_LOGGING_PATH", "./logs/"),
    },
  };

  const dionysus: DionysusConfig = {
    uploadPath: read.string("DIONYSUS_UPLOAD_PATH"),
    publishPath: read.string("DIONYSUS_PUBLISH_PATH"),
  };

  if (read.problems.length) throw new ConfigValidationError(read.problems);
  return { server, hasura, amqp, logging, dionysus };
};

/*
 * Typed configuration namespaces. Inject one with
 * `@Inject(hasuraConfig.KEY) hasura: ConfigType<typeof hasuraConfig>`, or
 * list `hasuraConfig.KEY` in a factory provider's `inject`.
 */
export const serverConfig = registerAs(
  "server",
  () => readConfig(process.env).server,
);
export const hasuraConfig = registerAs(
  "hasura",
  () => readConfig(process.env).hasura,
);
export const amqpConfig = registerAs(
  "amqp",
  () => readConfig(process.env).amqp,
);
export const loggingConfig = registerAs(
  "logging",
  () => readConfig(process.env).logging,
);
export const dionysusConfig = registerAs(
  "dionysus",
  () => readConfig(process.env).dionysus,
);

export type ServerConfigType = ConfigType<typeof serverConfig>;
export type HasuraConfigType = ConfigType<typeof hasuraConfig>;
export type AmqpConfigType = ConfigType<typeof amqpConfig>;
export type DionysusConfigType = ConfigType<typeof dionysusConfig>;

export const ALL_CONFIG = [
  serverConfig,
  hasuraConfig,
  amqpConfig,
  loggingConfig,
  dionysusConfig,
];
