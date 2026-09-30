import type {
  WeatherSeriesPoint,
  WeatherStationSeries,
} from "@ncfritz/olympus-model";
import { BadRequestException, Injectable } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import moment, { type Moment } from "moment";
import { type RollupTier, WeatherRollupService } from "./WeatherRollupService";
import { WeatherStationService } from "./WeatherStationService";

/** The most points one series answers with. */
export const MAX_POINTS = 2_000;
/** The most metrics one request asks for. */
export const MAX_METRICS = 12;

/**
 * Not a stored metric: the direction of the average wind, from its
 * east-west and north-south components (which average across north).
 */
export const WIND_DIRECTION = "wind_direction";
const WIND_X = "wind_x";
const WIND_Y = "wind_y";

/**
 * Not a stored tier: whole UTC days, combined from the hourly tier here.
 * Counts and sums add, minimums and maximums carry, so a day is exact; it
 * is what makes a year fit in MAX_POINTS.
 */
export const DAILY: RollupTier = {
  name: "1d",
  bucketSeconds: 86_400,
  retentionSeconds: null,
  sourceTier: "1h",
  builtUntil: null,
};

export type SeriesRequest = {
  metrics: string[];
  from: Moment;
  to: Moment;
  /** A tier's name, `1d`, or `auto`. */
  resolution: string;
};

type GraphQlMetric = { name: string; unit: string; rollup: string };

type GraphQlBucket = {
  bucketStart: string;
  sampleCount: number;
  sum: number;
  min: number;
  max: number;
  first: number;
  last: number;
  metric: { name: string };
};

/**
 * A station's history as series (ADR 0024, plan phase 8): for each metric
 * asked for, the buckets of one tier across a range. General on purpose,
 * for the station views now and other historical displays later.
 *
 * `auto` resolution is the finest tier that still holds `from` (its
 * retention reaches back that far) and whose buckets across the range fit
 * in MAX_POINTS, `1d` (DAILY) being the coarsest. A tier named outright is
 * used if it fits, and refused (400) if it does not.
 */
@Injectable()
export class WeatherSeriesService {
  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly stations: WeatherStationService,
    private readonly rollups: WeatherRollupService,
  ) {}

  async series(
    stationId: string,
    request: SeriesRequest,
    now: Moment = moment.utc(),
  ): Promise<WeatherStationSeries[]> {
    // 404 for a station that is not there, rather than empty series.
    await this.stations.describe(stationId);
    const tier = chooseTier(
      [...(await this.rollups.tiers()), DAILY],
      request.resolution,
      request.from,
      request.to,
      now,
    );
    const metrics = await this.metrics();
    for (const name of request.metrics) {
      if (name !== WIND_DIRECTION && !metrics.has(name)) {
        throw new BadRequestException(
          `metrics must be from ${[...metrics.keys(), WIND_DIRECTION].join(", ")}; ${name} is not one`,
        );
      }
    }

    const stored = new Set(
      request.metrics.flatMap((name) =>
        name === WIND_DIRECTION ? [WIND_X, WIND_Y] : [name],
      ),
    );
    const fetched = await this.buckets(
      stationId,
      tier === DAILY ? DAILY.sourceTier! : tier.name,
      [...stored],
      request.from,
      request.to,
    );
    const buckets = tier === DAILY ? byDay(fetched) : fetched;
    const byMetric = new Map<string, GraphQlBucket[]>();
    for (const bucket of buckets) {
      const list = byMetric.get(bucket.metric.name) ?? [];
      list.push(bucket);
      byMetric.set(bucket.metric.name, list);
    }

    return request.metrics.map((name) => {
      if (name === WIND_DIRECTION) {
        return {
          metric: WIND_DIRECTION,
          unit: "deg",
          rollup: "vector",
          resolution: tier.name,
          points: windDirections(
            byMetric.get(WIND_X) ?? [],
            byMetric.get(WIND_Y) ?? [],
          ),
        };
      }
      const metric = metrics.get(name)!;
      return {
        metric: name,
        unit: metric.unit,
        rollup: metric.rollup,
        resolution: tier.name,
        points: (byMetric.get(name) ?? []).map(toPoint),
      };
    });
  }

  private async metrics(): Promise<Map<string, GraphQlMetric>> {
    const document = gql`
      query ListWeatherMetrics {
        olympus_weather_metrics(order_by: { name: asc }) {
          name
          unit
          rollup
        }
      }
    `;
    type Result = { olympus_weather_metrics: GraphQlMetric[] };
    const result = await this.graphQLClient.request<Result>(document);
    return new Map(
      result.olympus_weather_metrics.map((metric) => [metric.name, metric]),
    );
  }

  private async buckets(
    stationId: string,
    tier: string,
    metrics: string[],
    from: Moment,
    to: Moment,
  ): Promise<GraphQlBucket[]> {
    const document = gql`
      query ListWeatherStationSeries(
        $stationId: uuid!
        $tier: String!
        $metrics: [String!]!
        $from: timestamptz!
        $to: timestamptz!
      ) {
        olympus_weather_station_rollups(
          where: {
            stationId: { _eq: $stationId }
            tier: { _eq: $tier }
            metric: { name: { _in: $metrics } }
            bucketStart: { _gte: $from, _lt: $to }
          }
          order_by: { bucketStart: asc }
        ) {
          bucketStart
          sampleCount
          sum
          min
          max
          first
          last
          metric {
            name
          }
        }
      }
    `;
    type Result = { olympus_weather_station_rollups: GraphQlBucket[] };
    const result = await this.graphQLClient.request<Result>(document, {
      stationId,
      tier,
      metrics,
      from: from.toISOString(),
      to: to.toISOString(),
    });
    return result.olympus_weather_station_rollups;
  }
}

/** The tier a request is answered from; 400 when none can. */
export const chooseTier = (
  tiers: RollupTier[],
  resolution: string,
  from: Moment,
  to: Moment,
  now: Moment,
): RollupTier => {
  const rangeSeconds = to.diff(from, "seconds");
  const fits = (tier: RollupTier) =>
    Math.ceil(rangeSeconds / tier.bucketSeconds) <= MAX_POINTS;
  const holds = (tier: RollupTier) =>
    tier.retentionSeconds === null ||
    !from.isBefore(now.clone().subtract(tier.retentionSeconds, "seconds"));

  if (resolution !== "auto") {
    const tier = tiers.find((candidate) => candidate.name === resolution);
    if (!tier) {
      throw new BadRequestException(
        `resolution must be auto or one of ${tiers.map((t) => t.name).join(", ")}`,
      );
    }
    if (!fits(tier)) {
      throw new BadRequestException(
        `${resolution} over that range is more than ${MAX_POINTS} points; ask for a coarser resolution or auto`,
      );
    }
    return tier;
  }
  const finestFirst = [...tiers].sort(
    (a, b) => a.bucketSeconds - b.bucketSeconds,
  );
  const tier =
    finestFirst.find((candidate) => holds(candidate) && fits(candidate)) ??
    finestFirst.find(fits);
  if (!tier) {
    throw new BadRequestException(
      `That range is more than ${MAX_POINTS} points at every resolution`,
    );
  }
  return tier;
};

/**
 * A request's query parameters, checked (ListWeatherStationSeries):
 * `metrics` comma separated, `from` and `to` ISO-8601 times, `resolution`
 * a tier, `1d`, or `auto` (the default).
 */
export const toSeriesRequest = (query: {
  metrics?: unknown;
  from?: unknown;
  to?: unknown;
  resolution?: unknown;
}): SeriesRequest => {
  const metrics =
    typeof query.metrics === "string"
      ? query.metrics
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean)
      : [];
  if (metrics.length === 0 || metrics.length > MAX_METRICS) {
    throw new BadRequestException(
      `metrics must name 1 to ${MAX_METRICS} metrics, comma separated`,
    );
  }
  if (new Set(metrics).size !== metrics.length) {
    throw new BadRequestException("metrics must not repeat");
  }
  const time = (value: unknown, name: string) => {
    const parsed =
      typeof value === "string"
        ? moment.utc(value, moment.ISO_8601, true)
        : undefined;
    if (!parsed?.isValid()) {
      throw new BadRequestException(`${name} must be an ISO-8601 time`);
    }
    return parsed;
  };
  const from = time(query.from, "from");
  const to = time(query.to, "to");
  if (!to.isAfter(from)) {
    throw new BadRequestException("to must be after from");
  }
  const resolution =
    query.resolution === undefined ? "auto" : String(query.resolution);
  return { metrics, from, to, resolution };
};

/** Hourly buckets combined into UTC days, per metric; oldest first. */
const byDay = (hours: GraphQlBucket[]): GraphQlBucket[] => {
  const days = new Map<string, GraphQlBucket>();
  for (const hour of hours) {
    const day = moment.utc(hour.bucketStart).startOf("day").toISOString();
    const key = `${hour.metric.name}|${day}`;
    const seen = days.get(key);
    if (!seen) {
      days.set(key, { ...hour, bucketStart: day });
      continue;
    }
    // Hours arrive oldest first, so the day's first is its first hour's.
    seen.sampleCount += hour.sampleCount;
    seen.sum += hour.sum;
    seen.min = Math.min(seen.min, hour.min);
    seen.max = Math.max(seen.max, hour.max);
    seen.last = hour.last;
  }
  return [...days.values()];
};

const toPoint = (bucket: GraphQlBucket): WeatherSeriesPoint => ({
  time: moment.utc(bucket.bucketStart),
  count: bucket.sampleCount,
  mean: bucket.sum / bucket.sampleCount,
  min: bucket.min,
  max: bucket.max,
  sum: bucket.sum,
  first: bucket.first,
  last: bucket.last,
});

/**
 * The direction of each bucket's average wind, in degrees from north, from
 * the averages of its components; a bucket with only one component (a
 * calm with no direction) has none.
 */
const windDirections = (
  xs: GraphQlBucket[],
  ys: GraphQlBucket[],
): WeatherSeriesPoint[] => {
  const byTime = new Map(ys.map((y) => [y.bucketStart, y]));
  return xs.flatMap((x) => {
    const y = byTime.get(x.bucketStart);
    if (!y) return [];
    const east = x.sum / x.sampleCount;
    const north = y.sum / y.sampleCount;
    const degrees = (Math.atan2(east, north) * 180) / Math.PI;
    return [
      {
        time: moment.utc(x.bucketStart),
        count: Math.min(x.sampleCount, y.sampleCount),
        mean: Math.round(((degrees + 360) % 360) * 10) / 10,
      },
    ];
  });
};
