import {
  ConfigValidationError,
  EnvReader,
  LoggingConfig,
  readLoggingConfig,
  readRuntimeConfig,
  RuntimeConfig,
} from "@ncfritz/olympus-nest";
import { ConfigType, registerAs } from "@nestjs/config";

export { ConfigValidationError };

/*
 * Phase 0 of docs/plans/email-management: the runtime and logging only.
 * The broker and the API client arrive with phase 1a (the Takeout import),
 * Gmail's OAuth client with phase 1b.
 */
export type AgentConfig = {
  runtime: RuntimeConfig;
  logging: LoggingConfig;
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
    logging: readLoggingConfig(read, runtime.isProduction),
  };
  if (read.problems.length) throw new ConfigValidationError(read.problems);
  return config;
};

/*
 * Typed configuration namespaces. Inject one with
 * `@Inject(runtimeConfig.KEY) runtime: RuntimeConfigType`.
 */
export const runtimeConfig = registerAs(
  "runtime",
  () => readConfig(process.env).runtime,
);

export type RuntimeConfigType = ConfigType<typeof runtimeConfig>;

export const ALL_CONFIG = [runtimeConfig];
