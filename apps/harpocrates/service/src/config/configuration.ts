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

export type HarpocratesConfig = {
  server: ServerConfig;
  logging: LoggingConfig;
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
  const config: HarpocratesConfig = {
    server: {
      ...runtime,
      apiExplorer:
        read.boolean("ENABLE_API_EXPLORER", false) || !runtime.isProduction,
    },
    logging: readLoggingConfig(read, runtime.isProduction),
  };
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

export type ServerConfigType = ConfigType<typeof serverConfig>;
export type LoggingConfigType = ConfigType<typeof loggingConfig>;

export const ALL_CONFIG = [serverConfig, loggingConfig];
