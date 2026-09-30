import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  publishMessage,
  WEATHER_ARCHIVE_LINE_ROUTE,
  type WeatherArchiveLine,
} from "@ncfritz/olympus-messages";
import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  weatherConfig,
  type WeatherConfigType,
} from "../../../config/configuration";
import { recordRelayPublish } from "../weatherMetrics";

/** A failing broker is logged at warn at most this often. */
const LOG_EVERY_MS = 10 * 60 * 1000;

/**
 * Publishes archive lines for the dev relay (ADR 0025), when
 * `WEATHER_RELAY_PUBLISH`: prod only.
 *
 * Never awaited by the push. The connection manager holds messages while
 * the broker is away, so a publish can take as long as the outage; the
 * push is stored and answered regardless, and what dev misses it replays.
 */
@Injectable()
export class StationRelay {
  private readonly logger = new Logger(StationRelay.name);
  private lastWarned = 0;

  constructor(
    private readonly amqpConnection: AmqpConnection,
    @Inject(weatherConfig.KEY) private readonly weather: WeatherConfigType,
  ) {}

  get enabled(): boolean {
    return this.weather.stations.relayPublish;
  }

  /** Starts the publish and returns at once. */
  publish(macAddress: string, line: WeatherArchiveLine): void {
    if (!this.enabled) return;
    publishMessage(
      this.amqpConnection,
      WEATHER_ARCHIVE_LINE_ROUTE,
      { macAddress, line },
      { persistent: true },
    ).then(
      () => recordRelayPublish("published"),
      (error: unknown) => {
        recordRelayPublish("failed");
        const message = `Could not publish an archive line for the dev relay: ${error instanceof Error ? error.message : String(error)}`;
        if (Date.now() - this.lastWarned >= LOG_EVERY_MS) {
          this.lastWarned = Date.now();
          this.logger.warn(message);
        } else {
          this.logger.debug(message);
        }
      },
    );
  }
}
