import { parse as parseQuery } from "node:querystring";
import {
  type WeatherArchiveRecord,
  WeatherArchiveRecordSource,
} from "@ncfritz/olympus-model";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import {
  AmbientReportError,
  normalizeMac,
  parseAmbientReport,
  type SampleReadings,
} from "../stations/ambientReport";
import { recordToQuery } from "../stations/ambientRecord";
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

/** The most lines one import takes: one insert, well inside Hasura's limits. */
export const MAX_IMPORT_RECORDS = 500;

/**
 * An import's records as ingest lines, checked (ImportWeatherStationReadings,
 * ADR 0025). Each must name a station by MAC and carry the fields every
 * archive line has; what the line says is the parser's business.
 */
export const toIngestLines = (records: unknown): IngestLine[] => {
  if (!Array.isArray(records) || records.length === 0) {
    throw new BadRequestException("records must be a non-empty array");
  }
  if (records.length > MAX_IMPORT_RECORDS) {
    throw new BadRequestException(
      `records may hold at most ${MAX_IMPORT_RECORDS} lines`,
    );
  }
  return records.map((value: unknown, index) => {
    const record = (value ?? {}) as Partial<WeatherArchiveRecord>;
    const macAddress = normalizeMac(
      typeof record.macAddress === "string" ? record.macAddress : undefined,
    );
    if (!macAddress) {
      throw new BadRequestException(
        `records[${index}].macAddress must be a MAC address`,
      );
    }
    if (typeof record.receivedAt !== "string") {
      throw new BadRequestException(
        `records[${index}].receivedAt must be a time`,
      );
    }
    if (
      !Object.values(WeatherArchiveRecordSource).includes(
        record.source as WeatherArchiveRecordSource,
      )
    ) {
      throw new BadRequestException(
        `records[${index}].source must be one of ${Object.values(WeatherArchiveRecordSource).join(", ")}`,
      );
    }
    for (const field of ["remote", "query", "responseJson"] as const) {
      if (record[field] !== undefined && typeof record[field] !== "string") {
        throw new BadRequestException(
          `records[${index}].${field} must be a string`,
        );
      }
    }
    let response: unknown;
    if (record.responseJson !== undefined) {
      try {
        response = JSON.parse(record.responseJson);
      } catch {
        throw new BadRequestException(
          `records[${index}].responseJson is not JSON`,
        );
      }
    }
    return {
      macAddress,
      line: {
        receivedAt: record.receivedAt,
        source: record.source as WeatherArchiveRecordSource,
        remote: record.remote,
        query: record.query,
        ...(response === undefined ? {} : { response }),
      },
    };
  });
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
      const receivedAt = moment.utc(line.receivedAt);
      if (!receivedAt.isValid()) {
        counts.invalid += 1;
        errors.push("receivedAt is not a time");
        continue;
      }
      const queries = readingsOf(macAddress, line);
      if (!queries) {
        counts.invalid += 1;
        errors.push(
          line.source === "push"
            ? "query is missing"
            : "response is not a list of records",
        );
        continue;
      }
      for (const query of queries) {
        let report;
        try {
          if (!query) throw new AmbientReportError("record has no dateutc");
          report = parseAmbientReport(query, receivedAt);
        } catch (error) {
          if (!(error instanceof AmbientReportError)) throw error;
          counts.invalid += 1;
          errors.push(error.message);
          continue;
        }
        const observedTime = report.observedAt.toISOString();
        const key = `${station.id}|${observedTime}`;
        const existing = rows.get(key);
        if (existing) {
          counts.duplicate += 1;
          // A push outranks a backfilled record of the same moment.
          if (existing.source === "push" && line.source === "backfill") {
            continue;
          }
        }
        rows.set(key, {
          stationId: station.id,
          observedTime,
          receivedTime: receivedAt.toISOString(),
          source: line.source,
          ...report.readings,
        });
      }
    }

    for (const source of ["push", "backfill"] as const) {
      const batch = [...rows.values()].filter((row) => row.source === source);
      if (batch.length === 0) continue;
      const written = await this.insert(batch, source, mode);
      counts.stored += written;
      counts.duplicate += batch.length - written;
    }
    if (counts.invalid > 0 || counts.unknown_station > 0) {
      this.logger.debug(
        `Ingest: ${counts.invalid} invalid, ${counts.unknown_station} from unknown stations`,
      );
    }
    return { counts, errors };
  }

  /**
   * Inserts one source's rows; answers how many were written. What a
   * reading already stored becomes (ADR 0024: a pushed sample is never
   * replaced by a backfilled one):
   *
   * | New      | ignore                    | replace                   |
   * | -------- | ------------------------- | ------------------------- |
   * | push     | replaces a backfilled one | replaces either           |
   * | backfill | kept as it was            | replaces a backfilled one |
   */
  private async insert(
    rows: SampleRow[],
    source: SampleRow["source"],
    mode: IngestMode,
  ): Promise<number> {
    const document = gql`
      mutation CreateWeatherStationSamples(
        $objects: [olympus_weather_station_samples_insert_input!]!
        $onConflict: olympus_weather_station_samples_on_conflict!
      ) {
        insert_olympus_weather_station_samples(
          objects: $objects
          on_conflict: $onConflict
        ) {
          affected_rows
        }
      }
    `;
    type Result = {
      insert_olympus_weather_station_samples: { affected_rows: number };
    };
    const updates = source === "push" || mode === "replace";
    const onlyOverBackfill = !(source === "push" && mode === "replace");
    const result = await this.graphQLClient.request<Result>(document, {
      // A row that may replace another carries every reading, so one it
      // does not have becomes null rather than keeping the old value.
      objects: updates ? rows.map(withEveryColumn) : rows,
      onConflict: {
        constraint: "weather_station_samples_station_id_observed_at_key",
        update_columns: updates
          ? [...READING_COLUMNS, "receivedTime", "source"]
          : [],
        ...(updates && onlyOverBackfill
          ? { where: { source: { _eq: "backfill" } } }
          : {}),
      },
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

/**
 * The upload-shaped queries in a line: a push's one query, or one per
 * record of a backfill response (undefined for a record with no usable
 * time). Undefined when the line has neither.
 */
const readingsOf = (
  macAddress: string,
  line: ArchiveLine,
): (Record<string, unknown> | undefined)[] | undefined => {
  if (line.source === "push") {
    return typeof line.query === "string"
      ? [parseQuery(stripLeadingQuestionMark(line.query))]
      : undefined;
  }
  return Array.isArray(line.response)
    ? line.response.map((record) => recordToQuery(macAddress, record))
    : undefined;
};
