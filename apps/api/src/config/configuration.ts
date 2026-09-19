import { ConfigType, registerAs } from "@nestjs/config";
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

export { ConfigValidationError };
export type { AmqpConfig, LoggingConfig };

export type ServerConfig = RuntimeConfig & {
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

/**
 * The API configuration from environment variables (see dev.env.example).
 * @throws ConfigValidationError listing every invalid or missing variable
 */
export const readConfig = (
  env: Record<string, string | undefined>,
): AppConfig => {
  const read = new EnvReader(env);

  const runtime = readRuntimeConfig(read, "olympus-api", 3100);
  const server: ServerConfig = {
    ...runtime,
    apiExplorer:
      read.boolean("ENABLE_API_EXPLORER", false) || !runtime.isProduction,
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

  const amqp = readAmqpConfig(read, "/dionysus");
  const logging = readLoggingConfig(read, runtime.isProduction);

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
