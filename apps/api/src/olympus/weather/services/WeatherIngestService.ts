import { parse as parseQuery } from "node:querystring";
import { Injectable, Logger } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import {
  AmbientReportError,
  parseAmbientReport,
  type SampleReadings,
} from "../stations/ambientReport";
import type { ArchiveLine } from "../stations/StationArchive";
import { WeatherStationService } from "./WeatherStationService";

/** An archive line and the station it belongs to. */
export type IngestLine = { macAddress: string; line: ArchiveLine };

/**
 * `ignore`: a reading already stored stays as it is (pushes, the relay,
 * an ordinary replay). `replace`: it is overwritten (a replay after a
 * parser fix).
 */
export type IngestMode = "ignore" | "replace";

export type IngestOutcome =
  "stored" | "duplicate" | "unknown_station" | "invalid" | "skipped";

export type IngestCounts = Record<IngestOutcome, number>;

export type IngestResult = {
  counts: IngestCounts;
  /** Why each invalid line was, in order; for a push's 400. */
  errors: string[];
};

/** Every reading column, by its Hasura name, for a replacing insert. */
const READING_COLUMNS: (keyof SampleReadings)[] = [
  "outdoorTemperatureF",
  "outdoorHumidityPct",
  "indoorTemperatureF",
  "indoorHumidityPct",
  "dewPointF",
  "feelsLikeF",
  "windSpeedMph",
  "windSpeedAvg10mMph",
  "windGustMph",
  "maxDailyGustMph",
  "windDirectionDeg",
  "windDirectionAvg10mDeg",
  "rainRateInHr",
  "rainEventIn",
  "rainDailyIn",
  "rainWeeklyIn",
  "rainMonthlyIn",
  "rainYearlyIn",
  "pressureRelativeInhg",
  "pressureAbsoluteInhg",
  "uvIndex",
  "solarRadiationWm2",
  "batteryOutdoorOk",
  "batteryIndoorOk",
];

type SampleRow = SampleReadings & {
  stationId: string;
  observedTime: string;
  receivedTime: string;
  source: "push" | "backfill";
};

/**
 * The one way station data gets into this environment's tables (ADR
 * 0025): an archive line in, parsed by this environment's own parser,
 * stored. A push, the relay from prod and a replay of the archive all end
 * here, so they cannot disagree about what a line means.
 *
 * Nothing here checks where a line came from or writes the archive: the
 * push path does both before calling this, and relayed and replayed lines
 * came from an archive already.
 */
@Injectable()
export class WeatherIngestService {
  private readonly logger = new Logger(WeatherIngestService.name);

  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly stations: WeatherStationService,
  ) {}

  async ingest(
    lines: IngestLine[],
    mode: IngestMode = "ignore",
  ): Promise<IngestResult> {
    const counts: IngestCounts = {
      stored: 0,
      duplicate: 0,
      unknown_station: 0,
      invalid: 0,
      skipped: 0,
    };
    const errors: string[] = [];
    // Keyed by station and time: a batch holding one reading twice (a
    // replayed day overlapping the relay) inserts it once, as the last copy.
    const rows = new Map<string, SampleRow>();

    for (const { macAddress, line } of lines) {
      const station = await this.stations.findByMac(macAddress);
      if (!station) {
        counts.unknown_station += 1;
        continue;
      }
      if (line.source !== "push" || typeof line.query !== "string") {
        // Backfill responses are phase 7's to read; until then they are
        // archived and kept, not stored.
        counts.skipped += 1;
        continue;
      }
      const receivedAt = moment.utc(line.receivedAt);
      if (!receivedAt.isValid()) {
        counts.invalid += 1;
        errors.push("receivedAt is not a time");
        continue;
      }
      let report;
      try {
        report = parseAmbientReport(
          parseQuery(stripLeadingQuestionMark(line.query)),
          receivedAt,
        );
      } catch (error) {
        if (!(error instanceof AmbientReportError)) throw error;
        counts.invalid += 1;
        errors.push(error.message);
        continue;
      }
      const observedTime = report.observedAt.toISOString();
      const key = `${station.id}|${observedTime}`;
      if (rows.has(key)) counts.duplicate += 1;
      rows.set(key, {
        stationId: station.id,
        observedTime,
        receivedTime: receivedAt.toISOString(),
        source: "push",
        ...report.readings,
      });
    }

    if (rows.size > 0) {
      const written = await this.insert([...rows.values()], mode);
      counts.stored += written;
      counts.duplicate += rows.size - written;
    }
    if (counts.invalid > 0 || counts.unknown_station > 0) {
      this.logger.debug(
        `Ingest: ${counts.invalid} invalid, ${counts.unknown_station} from unknown stations`,
      );
    }
    return { counts, errors };
  }

  /** Inserts the rows; answers how many were written. */
  private async insert(rows: SampleRow[], mode: IngestMode): Promise<number> {
    const document = gql`
      mutation CreateWeatherStationSamples(
        $objects: [olympus_weather_station_samples_insert_input!]!
        $updateColumns: [olympus_weather_station_samples_update_column!]!
      ) {
        insert_olympus_weather_station_samples(
          objects: $objects
          on_conflict: {
            constraint: weather_station_samples_station_id_observed_at_key
            update_columns: $updateColumns
          }
        ) {
          affected_rows
        }
      }
    `;
    type Result = {
      insert_olympus_weather_station_samples: { affected_rows: number };
    };
    const result = await this.graphQLClient.request<Result>(document, {
      // A replacing insert rewrites every reading, so one the new parser no
      // longer reads becomes null rather than keeping the old value.
      objects: mode === "replace" ? rows.map(withEveryColumn) : rows,
      updateColumns:
        mode === "replace"
          ? [...READING_COLUMNS, "receivedTime", "source"]
          : [],
    });
    return result.insert_olympus_weather_station_samples.affected_rows;
  }
}

const withEveryColumn = (row: SampleRow): SampleRow => ({
  ...Object.fromEntries(READING_COLUMNS.map((column) => [column, null])),
  ...row,
});

/** The archive keeps the query as received; a `?` may lead it. */
const stripLeadingQuestionMark = (query: string) =>
  query.startsWith("?") ? query.slice(1) : query;
