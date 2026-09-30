import { Nack, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { WeatherApi } from "@ncfritz/olympus-client";
import type { WeatherArchiveRecord } from "@ncfritz/olympus-sdk/olympus";
import { Injectable, Logger } from "@nestjs/common";
import {
  WEATHER_RELAY_HANDLER,
  type WeatherArchiveLineMessage,
} from "../../messaging";
import { recordRelayedLine } from "../relayMetrics";

/** Waits after a failed import: 5 s, doubling, at most a minute. */
const FIRST_WAIT_MS = 5_000;
const LONGEST_WAIT_MS = 60_000;

/**
 * One archive line from prod, into this environment through its API
 * (ImportWeatherStationReadings, ADR 0025). The API parses it with its own
 * parser and stores it unless it already has the reading, so a line
 * delivered twice is harmless.
 *
 * A line the API answered for is acknowledged whatever it made of it: an
 * unknown station or an unparseable line will not improve by retrying,
 * and the counts say what happened. A line the API did not answer for (it
 * is down, or refused the call) goes back on the queue after a wait that
 * grows while the failures continue, and with one line in flight at a
 * time the queue holds everything else until the API is back.
 */
@Injectable()
export class WeatherArchiveLineHandler {
  private readonly logger = new Logger(WeatherArchiveLineHandler.name);
  private failures = 0;

  constructor(private readonly weather: WeatherApi) {}

  @RabbitSubscribe({ name: WEATHER_RELAY_HANDLER })
  async handle(message: WeatherArchiveLineMessage): Promise<Nack | void> {
    const record = toRecord(message);
    if (!record) {
      // Not a line at all: nothing to retry.
      recordRelayedLine("invalid");
      this.logger.warn("Dropped a message that is not an archive line");
      return;
    }
    try {
      const outcome = await this.weather.importWeatherStationReadings([record]);
      for (const [result, count] of Object.entries({
        stored: outcome.stored,
        duplicate: outcome.duplicate,
        unknown_station: outcome.unknownStation,
        invalid: outcome.invalid,
        skipped: outcome.skipped,
      })) {
        if (count > 0) recordRelayedLine(result);
      }
      if (this.failures > 0) {
        this.logger.log(
          `The API is answering again after ${this.failures} failed imports`,
        );
      }
      this.failures = 0;
    } catch (error) {
      this.failures += 1;
      recordRelayedLine("failed");
      const wait = Math.min(
        FIRST_WAIT_MS * 2 ** (this.failures - 1),
        LONGEST_WAIT_MS,
      );
      const log =
        this.failures === 1 || this.failures % 10 === 0
          ? this.logger.warn.bind(this.logger)
          : this.logger.debug.bind(this.logger);
      log(
        `Import failed (${this.failures} in a row), retrying in ${wait / 1000}s: ${describe(error)}`,
      );
      await this.wait(wait);
      return new Nack(true);
    }
  }

  /** The pause before a failed line goes back; replaced in the tests. */
  protected wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/** The message as the import's record, or undefined if it is not one. */
const toRecord = (
  message: WeatherArchiveLineMessage | undefined,
): WeatherArchiveRecord | undefined => {
  const line = message?.line;
  if (
    typeof message?.macAddress !== "string" ||
    !line ||
    typeof line.receivedAt !== "string" ||
    (line.source !== "push" && line.source !== "backfill")
  ) {
    return undefined;
  }
  return {
    macAddress: message.macAddress,
    receivedAt: line.receivedAt,
    source: line.source,
    remote: line.remote,
    query: line.query,
  };
};

const describe = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
