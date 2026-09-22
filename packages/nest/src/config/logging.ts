import type { EnvReader } from "./EnvReader";

export const LOG_LEVELS = [
  "error",
  "warn",
  "info",
  "http",
  "verbose",
  "debug",
  "silly",
] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export type LoggingConfig = {
  level: LogLevel;
  console: { enabled: boolean; level: LogLevel };
  loki: { url?: string; level: LogLevel };
  file: { enabled: boolean; level: LogLevel; path: string };
};

/**
 * LOKI_LEVEL (overall), CONSOLE_LOGGING_LEVEL / ENABLE_CONSOLE_LOGGING,
 * LOKI_URL / LOKI_LOGGING_LEVEL and FILE_LOGGING_ENABLED /
 * FILE_LOGGING_LEVEL / FILE_LOGGING_PATH. By default console logging is on
 * outside production and file logging in production; either variable
 * overrides that (a container logs to the console and not to files).
 */
export const readLoggingConfig = (
  read: EnvReader,
  isProduction: boolean,
): LoggingConfig => {
  const level = (name: string, fallback: LogLevel) =>
    read.oneOf(name, LOG_LEVELS, fallback);
  return {
    level: level("LOKI_LEVEL", "debug"),
    console: {
      enabled: read.boolean("ENABLE_CONSOLE_LOGGING", !isProduction),
      level: level("CONSOLE_LOGGING_LEVEL", "info"),
    },
    loki: {
      url: read.optional("LOKI_URL"),
      level: level("LOKI_LOGGING_LEVEL", "info"),
    },
    file: {
      enabled: read.boolean("FILE_LOGGING_ENABLED", isProduction),
      level: level("FILE_LOGGING_LEVEL", "info"),
      path: read.string("FILE_LOGGING_PATH", "./logs/"),
    },
  };
};
