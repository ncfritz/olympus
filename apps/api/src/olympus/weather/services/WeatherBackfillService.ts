import type {
  WeatherStation,
  WeatherStationBackfill,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import moment, { type Moment } from "moment";
import {
  weatherConfig,
  type WeatherConfigType,
} from "../../../config/configuration";
import { AmbientClient } from "../providers/AmbientClient";
import { parseDay } from "../stations/archiveReader";
import { StationArchive } from "../stations/StationArchive";
import { recordBackfill } from "../weatherMetrics";
import { WeatherIngestService } from "./WeatherIngestService";
import { WeatherRollupService } from "./WeatherRollupService";
import { WeatherStationService } from "./WeatherStationService";

/** A gap worth filling: the console pushes every ~16 seconds. */
export const MIN_GAP_MS = 10 * 60 * 1000;
/** The newest stretch left alone: pushes may still be arriving. */
const SETTLE_MS = 15 * 60 * 1000;
/** Samples this close to their retention are not worth fetching. */
const RETENTION_MARGIN_MS = 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
/** The first automatic run, once the API has settled after starting. */
const FIRST_RUN_MS = 2 * 60 * 1000;

export type Gap = { from: Moment; to: Moment };

export type BackfillSummary = {
  requests: number;
  records: number;
  stored: number;
};

export type BackfillRequest = {
  /** First UTC day, inclusive. */
  from: Moment;
  /** Last UTC day, inclusive. */
  to: Moment;
  stationId?: string;
};

/**
 * Fills gaps in the stations' samples from ambientweather.net (ADR 0024,
 * plan phase 7), in prod only (`WEATHER_BACKFILL_ENABLED`, with the Ambient
 * keys).
 *
 * At start and hourly, each station's samples within their retention are
 * searched for stretches of more than ten minutes with none; each is
 * fetched from Ambient (5-minute steps, a day per request, a request a
 * second), and every response is archived as received (`"source":
 * "backfill"`, never the request, which carries the keys) and stored like
 * any other archive line: a pushed sample is never replaced by a
 * backfilled one. The tiers are then rebuilt over the hours the gap
 * touched. An admin can ask for any range of days (older history, or a
 * gap the samples no longer show) with BackfillWeatherStations.
 *
 * One run at a time. The rollup schedule waits for a run, as it does for a
 * replay, so the hourly prune never removes samples before they are rolled
 * up.
 */
@Injectable()
export class WeatherBackfillService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(WeatherBackfillService.name);
  private readonly timers: NodeJS.Timeout[] = [];
  private current?: Promise<unknown>;

  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly ambient: AmbientClient,
    private readonly stations: WeatherStationService,
    private readonly archive: StationArchive,
    private readonly ingest: WeatherIngestService,
    private readonly rollups: WeatherRollupService,
    @Inject(weatherConfig.KEY) private readonly weather: WeatherConfigType,
  ) {}

  get enabled(): boolean {
    return this.weather.stations.backfillEnabled && this.ambient.configured;
  }

  get running(): boolean {
    return this.current !== undefined;
  }

  onApplicationBootstrap(): void {
    if (!this.weather.stations.backfillEnabled) return;
    if (!this.ambient.configured) {
      this.logger.warn(
        "WEATHER_BACKFILL_ENABLED is set but the Ambient keys are not: backfill is off",
      );
      return;
    }
    const run = () => {
      if (this.running) return;
      this.exclusive(() => this.fillGaps()).catch((error: unknown) =>
        this.logger.warn(`Backfill failed: ${describe(error)}`),
      );
    };
    this.timers.push(setTimeout(run, FIRST_RUN_MS), setInterval(run, HOUR_MS));
    for (const timer of this.timers) timer.unref();
  }

  onApplicationShutdown(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.length = 0;
  }

  /** Every station's gaps within the samples' retention, filled. */
  async fillGaps(now: Moment = moment.utc()): Promise<BackfillSummary> {
    const summary: BackfillSummary = { requests: 0, records: 0, stored: 0 };
    const from = now
      .clone()
      .subtract(this.weather.stations.sampleRetentionHours, "hours")
      .add(RETENTION_MARGIN_MS, "ms");
    const to = now.clone().subtract(SETTLE_MS, "ms");
    for (const station of await this.stations.list()) {
      const gaps = findGaps(
        await this.sampleTimes(station, from, to),
        from,
        to,
      );
      for (const gap of gaps) {
        this.logger.log(
          `Backfilling ${station.name}: ${gap.from.toISOString()} to ${gap.to.toISOString()}`,
        );
        add(summary, await this.fill(station, gap));
      }
    }
    if (summary.requests > 0) {
      this.logger.log(
        `Backfill: ${summary.requests} requests, ${summary.records} records, ${summary.stored} stored`,
      );
    }
    return summary;
  }

  /**
   * An admin's range, a day at a time. Answers once it has started; the
   * summary is logged.
   */
  async start(request: BackfillRequest): Promise<void> {
    if (request.stationId) {
      // A 404 now rather than a failure in the log later.
      await this.stations.describe(request.stationId);
    }
    if (!this.enabled) {
      throw new ConflictException(
        "Backfill is off here (WEATHER_BACKFILL_ENABLED and the Ambient keys)",
      );
    }
    if (this.running) {
      throw new ConflictException("A backfill is already running");
    }
    this.exclusive(() => this.backfill(request))
      .then((summary) =>
        this.logger.log(
          `Backfill of ${request.from.format("YYYY-MM-DD")}..${request.to.format("YYYY-MM-DD")}: ` +
            `${summary.requests} requests, ${summary.records} records, ${summary.stored} stored`,
        ),
      )
      .catch((error: unknown) =>
        this.logger.warn(`Backfill failed: ${describe(error)}`),
      );
  }

  async backfill(request: BackfillRequest): Promise<BackfillSummary> {
    const summary: BackfillSummary = { requests: 0, records: 0, stored: 0 };
    const stations = request.stationId
      ? [await this.stations.describe(request.stationId)]
      : await this.stations.list();
    // Oldest first, so each day's rain is measured from the day before.
    const last = request.to.clone().utc().startOf("day");
    for (
      const day = request.from.clone().utc().startOf("day");
      !day.isAfter(last);
      day.add(1, "day")
    ) {
      const gap = { from: day.clone(), to: day.clone().add(1, "day") };
      for (const station of stations) {
        add(summary, await this.fill(station, gap));
      }
    }
    return summary;
  }

  /**
   * One gap: pages back from its end until a page reaches its start (or
   * Ambient has nothing older), each page archived and stored; then the
   * tiers rebuilt over the hours it touched.
   */
  private async fill(
    station: WeatherStation,
    gap: Gap,
  ): Promise<BackfillSummary> {
    const summary: BackfillSummary = { requests: 0, records: 0, stored: 0 };
    let endDate = gap.to.clone();
    for (;;) {
      const records = await this.ambient.deviceData(
        station.macAddress,
        endDate,
      );
      summary.requests += 1;
      summary.records += records.length;
      recordBackfill("records", records.length);
      if (records.length === 0) break;

      const line = {
        receivedAt: moment.utc().toISOString(),
        source: "backfill" as const,
        response: records,
      };
      await this.archive.append(station.macAddress, line);
      const { counts } = await this.ingest.ingest([
        { macAddress: station.macAddress, line },
      ]);
      summary.stored += counts.stored;
      recordBackfill("stored", counts.stored);

      const oldest = oldestTime(records);
      // Done once a page reaches the gap's start; and never ask twice for
      // the same page, whatever Ambient answers.
      if (!oldest || !oldest.isAfter(gap.from) || !oldest.isBefore(endDate)) {
        break;
      }
      endDate = oldest.subtract(1, "ms");
    }

    const from = gap.from.clone().startOf("hour");
    const to = gap.to.clone().add(59, "minutes").startOf("hour");
    for (const tier of await this.rollups.tiers()) {
      await this.rollups.build(tier, from, to);
    }
    return summary;
  }

  /** The station's sample times in [from, to), oldest first. */
  private async sampleTimes(
    station: WeatherStation,
    from: Moment,
    to: Moment,
  ): Promise<Moment[]> {
    const document = gql`
      query ListWeatherStationSampleTimes(
        $stationId: uuid!
        $from: timestamptz!
        $to: timestamptz!
      ) {
        olympus_weather_station_samples(
          where: {
            stationId: { _eq: $stationId }
            observedTime: { _gte: $from, _lt: $to }
          }
          order_by: { observedTime: asc }
        ) {
          observedTime
        }
      }
    `;
    type Result = {
      olympus_weather_station_samples: { observedTime: string }[];
    };
    const result = await this.graphQLClient.request<Result>(document, {
      stationId: station.id,
      from: from.toISOString(),
      to: to.toISOString(),
    });
    return result.olympus_weather_station_samples.map((sample) =>
      moment.utc(sample.observedTime),
    );
  }

  private exclusive<T>(run: () => Promise<T>): Promise<T> {
    const running = run().finally(() => {
      this.current = undefined;
    });
    this.current = running;
    return running;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An admin's backfill, checked (BackfillWeatherStations). */
export const toBackfillRequest = (
  backfill: WeatherStationBackfill | undefined,
): BackfillRequest => {
  if (!backfill || typeof backfill !== "object") {
    throw new BadRequestException("backfill is required");
  }
  const from = parseDay(backfill.from);
  const to = parseDay(backfill.to);
  if (!from || !to) {
    throw new BadRequestException("from and to must be days, YYYY-MM-DD");
  }
  if (to.isBefore(from)) {
    throw new BadRequestException("to must not be before from");
  }
  if (
    backfill.stationId !== undefined &&
    (typeof backfill.stationId !== "string" || !UUID.test(backfill.stationId))
  ) {
    throw new BadRequestException("stationId must be a station's ID");
  }
  return { from, to, stationId: backfill.stationId };
};

/**
 * The stretches of [from, to) longer than MIN_GAP_MS with no sample,
 * including before the first and after the last. `times` oldest first.
 */
export const findGaps = (times: Moment[], from: Moment, to: Moment): Gap[] => {
  const gaps: Gap[] = [];
  let previous = from;
  for (const time of [...times, to]) {
    if (time.diff(previous) > MIN_GAP_MS) {
      gaps.push({ from: previous.clone(), to: time.clone() });
    }
    previous = time;
  }
  return gaps;
};

/** The oldest record's time, or undefined if none has one. */
const oldestTime = (records: { dateutc: unknown }[]): Moment | undefined => {
  const times = records
    .map(({ dateutc }) =>
      typeof dateutc === "number"
        ? moment.utc(dateutc)
        : typeof dateutc === "string"
          ? moment.utc(dateutc, moment.ISO_8601, true)
          : undefined,
    )
    .filter((time): time is Moment => time?.isValid() === true);
  return times.length > 0 ? moment.min(times) : undefined;
};

const add = (total: BackfillSummary, part: BackfillSummary) => {
  total.requests += part.requests;
  total.records += part.records;
  total.stored += part.stored;
};

const describe = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
