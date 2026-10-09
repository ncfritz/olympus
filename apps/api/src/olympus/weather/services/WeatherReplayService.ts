import {
  type WeatherArchiveReplay,
  WeatherArchiveReplayMode,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import moment, { type Moment } from "moment";
import {
  weatherConfig,
  type WeatherConfigType,
} from "../../../config/configuration";
import { normalizeMac } from "../stations/ambientReport";
import {
  type ArchiveDay,
  parseDay,
  readArchive,
} from "../stations/archiveReader";
import { recordReplayLines } from "../weatherMetrics";
import {
  type IngestCounts,
  type IngestMode,
  WeatherIngestService,
} from "./WeatherIngestService";
import { WeatherRollupService } from "./WeatherRollupService";

export type ReplayRequest = {
  /** First UTC day, inclusive. */
  from: Moment;
  /** Last UTC day, inclusive. */
  to: Moment;
  macAddress?: string;
  mode: IngestMode;
  /** The archive to read; the API's own (WEATHER_ARCHIVE_DIR) when absent. */
  dir?: string;
};

export type ReplaySummary = {
  days: number;
  files: number;
  lines: number;
  unreadable: number;
  counts: IngestCounts;
  rollupRows: number;
};

/**
 * A replay as the API was asked for it, checked. From the endpoint only:
 * the archive it reads is the API's own, never a path from a request.
 */
export const toReplayRequest = (
  replay: WeatherArchiveReplay | undefined,
): ReplayRequest => {
  if (!replay || typeof replay !== "object") {
    throw new BadRequestException("replay is required");
  }
  const from = parseDay(replay.from);
  const to = parseDay(replay.to);
  if (!from || !to) {
    throw new BadRequestException("from and to must be days, YYYY-MM-DD");
  }
  if (to.isBefore(from)) {
    throw new BadRequestException("to must not be before from");
  }
  let macAddress: string | undefined;
  if (replay.macAddress !== undefined) {
    macAddress = normalizeMac(
      typeof replay.macAddress === "string" ? replay.macAddress : undefined,
    );
    if (!macAddress) {
      throw new BadRequestException(
        "macAddress must be a MAC address, e.g. A0:B1:C2:D3:E4:F5",
      );
    }
  }
  const mode = replay.mode ?? WeatherArchiveReplayMode.Ignore;
  if (!Object.values(WeatherArchiveReplayMode).includes(mode)) {
    throw new BadRequestException(
      `mode must be one of ${Object.values(WeatherArchiveReplayMode).join(", ")}`,
    );
  }
  return { from, to, macAddress, mode };
};

/** Lines per insert: one Hasura request, well inside its limits. */
const BATCH = 500;

/**
 * Loads a range of the raw archive again (ADR 0024, 0025): after
 * `refresh-dev` (whose backup has no weather rows), on a new machine, after
 * a parser fix (`replace`), or to fill what the relay missed.
 *
 * A day at a time, oldest first: every station's lines for the day go
 * through WeatherIngestService, then every tier is rebuilt for that day,
 * then retention runs. So a year of history never sits in the samples
 * table at once, and a day older than a tier's retention is built into it
 * and removed again, leaving only the tiers that keep it. The day before
 * is kept until the next day is built, because rain is measured from the
 * previous sample.
 *
 * One replay at a time per API. The schedule's hourly prune could remove a
 * replayed day's samples between their insert and their rollup; in this
 * process the schedule waits for a replay, and a CLI replay is a matter of
 * seconds per day.
 */
@Injectable()
export class WeatherReplayService {
  private readonly logger = new Logger(WeatherReplayService.name);
  private current?: Promise<ReplaySummary>;

  constructor(
    private readonly ingest: WeatherIngestService,
    private readonly rollups: WeatherRollupService,
    @Inject(weatherConfig.KEY) private readonly weather: WeatherConfigType,
  ) {}

  get running(): boolean {
    return this.current !== undefined;
  }

  /**
   * Starts a replay and answers once it has started; the summary is
   * logged. For the endpoint, which answers 202.
   */
  start(request: ReplayRequest): void {
    this.replay(request).catch((error: unknown) => {
      this.logger.error(
        `Replay of ${describeRange(request)} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  /** Runs a replay to the end. */
  replay(
    request: ReplayRequest,
    onDay?: (day: string, summary: ReplaySummary) => void,
  ): Promise<ReplaySummary> {
    if (this.current) {
      throw new ConflictException("A replay is already running");
    }
    this.current = this.run(request, onDay).finally(() => {
      this.current = undefined;
    });
    return this.current;
  }

  private async run(
    request: ReplayRequest,
    onDay?: (day: string, summary: ReplaySummary) => void,
  ): Promise<ReplaySummary> {
    const dir = request.dir ?? this.weather.stations.archiveDir;
    const tiers = await this.rollups.tiers();
    const summary: ReplaySummary = {
      days: 0,
      files: 0,
      lines: 0,
      unreadable: 0,
      counts: {
        stored: 0,
        duplicate: 0,
        unknown_station: 0,
        invalid: 0,
        skipped: 0,
      },
      rollupRows: 0,
    };
    this.logger.log(`Replaying ${describeRange(request)} from ${dir}`);

    let day: string | undefined;
    const finish = async (finished: string) => {
      const start = moment.utc(finished, "YYYY-MM-DD");
      const end = start.clone().add(1, "day");
      for (const tier of tiers) {
        summary.rollupRows += await this.rollups.build(tier, start, end);
      }
      const retention = moment
        .utc()
        .subtract(this.weather.stations.sampleRetentionHours, "hours");
      // The finished day stays for the next day's rain; anything before it
      // goes if retention says so.
      await this.rollups.prune(moment.min(retention, start));
      summary.days += 1;
      onDay?.(finished, summary);
    };

    for await (const file of readArchive(dir, {
      from: request.from,
      to: request.to,
      macAddress: request.macAddress,
    })) {
      if (day !== undefined && file.day !== day) await finish(day);
      day = file.day;
      await this.load(file, request.mode, summary);
    }
    if (day !== undefined) await finish(day);

    this.logger.log(
      `Replayed ${describeRange(request)}: ${summary.days} days, ${summary.lines} lines ` +
        `(${summary.counts.stored} stored, ${summary.counts.duplicate} duplicate, ` +
        `${summary.counts.invalid} invalid, ${summary.counts.unknown_station} unknown station, ` +
        `${summary.counts.skipped} skipped, ${summary.unreadable} unreadable), ` +
        `${summary.rollupRows} rollup rows`,
    );
    return summary;
  }

  private async load(
    file: ArchiveDay,
    mode: IngestMode,
    summary: ReplaySummary,
  ): Promise<void> {
    summary.files += 1;
    summary.lines += file.lines.length + file.unreadable;
    summary.unreadable += file.unreadable;
    recordReplayLines("unreadable", file.unreadable);
    for (let at = 0; at < file.lines.length; at += BATCH) {
      const { counts } = await this.ingest.ingest(
        file.lines
          .slice(at, at + BATCH)
          .map((line) => ({ macAddress: file.macAddress, line })),
        mode,
      );
      for (const [outcome, count] of Object.entries(counts) as [
        keyof IngestCounts,
        number,
      ][]) {
        summary.counts[outcome] += count;
        recordReplayLines(outcome, count);
      }
    }
  }
}

const describeRange = (request: ReplayRequest) =>
  `${request.from.format("YYYY-MM-DD")}..${request.to.format("YYYY-MM-DD")}` +
  (request.macAddress ? ` for ${request.macAddress}` : "") +
  ` (${request.mode})`;
