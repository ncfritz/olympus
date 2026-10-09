/**
 * Weather station archive lines (ADR 0025): prod's API publishes every
 * line it writes to the raw station archive to WEATHER_STATION_REPORTS_EXCHANGE
 * on `/dionysus`; a shovel in the broker's definitions carries them to the
 * exchange of the same name on `/dionysus-dev`, where the weather relay
 * agent consumes them into a development database.
 *
 * The payload is the archive line itself, raw, so the receiving
 * environment parses it with its own code.
 */

import { exchange, route } from "./routing";

/** Fanout: every queue bound to it gets every line. */
export const WEATHER_STATION_REPORTS_EXCHANGE = exchange(
  "weather.station.reports",
  "fanout",
);

/** One line of the raw station archive, as the API wrote it. */
export interface WeatherArchiveLine {
  /** ISO-8601 time the API received the push (or the response). */
  receivedAt: string;
  source: "push" | "backfill";
  /** The address a push came from, as the API saw it. */
  remote?: string;
  /** A push's query string, exactly as received. */
  query?: string;
  /** A backfill response body (plan phase 7). */
  response?: unknown;
}

export interface WeatherArchiveLineMessage {
  /** The station's console MAC, upper case with colons. */
  macAddress: string;
  line: WeatherArchiveLine;
}

/** A fanout ignores the key; it names what the message is. */
export const WEATHER_ARCHIVE_LINE_ROUTE = route<WeatherArchiveLineMessage>(
  WEATHER_STATION_REPORTS_EXCHANGE,
  "weather.archive.line",
);
