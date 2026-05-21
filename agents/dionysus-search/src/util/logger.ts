import fs from "fs";
import winston from "winston";
import LokiTransport from "winston-loki";
import { IS_PROD } from "./constants";

export const appName =
  process.env.APP_NAME ||
  `dionysus-search-agents${IS_PROD ? "" : `-${process.env.NODE_ENV}`}`;

const consoleLoggingEnabled =
  !IS_PROD || process.env.ENABLE_CONSOLE_LOGGING === "true";
const consoleLoggingLevel = process.env.CONSOLE_LOGGING_LEVEL || "info";
const lokiLoggingEnabled = process.env.LOKI_URL;
const lokiLoggingLevel = process.env.CONSOLE_LOGGING_LEVEL || "info";

const transports = [];

if (lokiLoggingEnabled) {
  transports.push(
    new LokiTransport({
      host: process.env.LOKI_URL!,
      level: lokiLoggingLevel,
      labels: {
        app: appName,
      },
      json: true,
      format: winston.format.json(),
      replaceTimestamp: true,
      clearOnError: true,
      onConnectionError: (e) => console.log(e),
    }),
  );
}

if (consoleLoggingEnabled) {
  transports.push(
    new winston.transports.Console({
      level: consoleLoggingLevel,
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.align(),
        winston.format.printf(
          (info) => `${info.timestamp} [${info.level}]: ${info.message}`,
        ),
      ),
    }),
  );
}

if (transports.length <= 0) {
  transports.push(
    new winston.transports.Stream({
      stream: fs.createWriteStream("/dev/null"),
    }),
  );
}

export const logger = winston.createLogger({
  level: process.env.LOKI_LEVEL || "debug",
  format: winston.format.json(),
  defaultMeta: { service: appName },
  transports: transports,
});

logger.info(
  `Console logging ${consoleLoggingEnabled ? "enabled" : "disabled"} - level "${consoleLoggingLevel}"`,
);
logger.info(
  `Loki logging ${lokiLoggingEnabled ? "enabled" : "disabled"} - level "${lokiLoggingLevel}" - to ${process.env.LOKI_URL}`,
);
