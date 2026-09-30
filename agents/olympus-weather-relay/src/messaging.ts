/**
 * RabbitMQ names this agent uses. The exchange, routing key and payload
 * come from the shared contract (@ncfritz/olympus-messages); the queue is
 * the agent's own, one per database it feeds (ADR 0025).
 */
export {
  WEATHER_ARCHIVE_LINE_ROUTE,
  WEATHER_STATION_REPORTS_EXCHANGE,
  type WeatherArchiveLineMessage,
} from "@ncfritz/olympus-messages";

/**
 * The handler's name in RabbitModule's `handlers`: its queue depends on the
 * configuration, which a decorator cannot read, so the binding is made
 * there and the handler refers to it by this name.
 */
export const WEATHER_RELAY_HANDLER = "weatherRelay";

/** The queue feeding `database`, e.g. `weather.station.reports.olympus_dev`. */
export const relayQueue = (database: string) =>
  `weather.station.reports.${database}`;

const HOUR_MS = 60 * 60 * 1000;

/**
 * The queue's bounds (ADR 0025). 48 hours of lines, which always overlaps
 * what replay can read from sealed days; at most 30,000 of them, the
 * oldest dropped first (two stations push about 10,800 a day); and gone a
 * week after nothing has read it, so a laptop's queue does not outlive the
 * laptop's interest. A queue declared with other bounds is refused by the
 * broker, so changing these means deleting the queue first.
 */
export const RELAY_QUEUE_ARGUMENTS = {
  "x-message-ttl": 48 * HOUR_MS,
  "x-max-length": 30_000,
  "x-overflow": "drop-head",
  "x-expires": 7 * 24 * HOUR_MS,
} as const;
