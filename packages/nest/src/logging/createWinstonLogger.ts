import fs from "fs";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import LokiTransport from "winston-loki";
import type { LoggingConfig } from "../config/logging";

/**
 * The Winston logger behind Nest's Logger (see main.ts): console, Loki and
 * rotating-file transports as configured. Code logs through
 * `new Logger(Class.name)` from @nestjs/common, never through Winston.
 */
export const createWinstonLogger = (
  config: LoggingConfig,
  appName: string,
): winston.Logger => {
  const transports: winston.transport[] = [];

  if (config.loki.url) {
    transports.push(
      new LokiTransport({
        host: config.loki.url,
        level: config.loki.level,
        labels: { app: appName },
        json: true,
        format: winston.format.json(),
        replaceTimestamp: true,
        clearOnError: true,
        onConnectionError: (e) => console.log(e),
      }),
    );
  }

  if (config.console.enabled) {
    transports.push(
      new winston.transports.Console({
        level: config.console.level,
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.align(),
          winston.format.printf(
            (info) =>
              `${info.timestamp} [${info.level}]${info.context ? ` [${info.context}]` : ""}: ${info.message}${info.stack ? `\n${info.stack}` : ""}`,
          ),
        ),
      }),
    );
  }

  if (config.file.enabled) {
    transports.push(
      new DailyRotateFile({
        level: config.file.level,
        dirname: config.file.path,
        filename: "application-%DATE%.log",
        datePattern: "YYYY-MM-DD-HH",
        zippedArchive: true,
        maxSize: "200m",
        maxFiles: "14d",
      }),
    );
  }

  if (transports.length === 0) {
    transports.push(
      new winston.transports.Stream({
        stream: fs.createWriteStream("/dev/null"),
      }),
    );
  }

  const logger = winston.createLogger({
    level: config.level,
    format: winston.format.json(),
    defaultMeta: { service: appName },
    transports,
  });

  logger.info(
    `Console logging ${config.console.enabled ? "enabled" : "disabled"} - level "${config.console.level}"`,
  );
  logger.info(
    `Loki logging ${config.loki.url ? "enabled" : "disabled"} - level "${config.loki.level}" - to ${config.loki.url}`,
  );
  return logger;
};
