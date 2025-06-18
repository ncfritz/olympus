import winston from "winston";
import LokiTransport from "winston-loki";

export const logger = winston.createLogger({
  level: "debug",
  format: winston.format.json(),
  defaultMeta: { service: "dionysus-md-agent" },
  transports: [
    new LokiTransport({
      host: process.env.LOKI_URL || "http://localhost:4100",
      labels: {
        app: "dionysus-md-agents",
      },
      json: true,
      format: winston.format.json(),
      replaceTimestamp: true,
      clearOnError: true,
    }),
  ],
});

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      level: "debug",
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
