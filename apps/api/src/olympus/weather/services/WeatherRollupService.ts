import { Injectable } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import moment, { type Moment } from "moment";
import { recordRollupRows } from "../weatherMetrics";

/** A tier as `weather_rollup_tiers` has it. */
export type RollupTier = {
  name: string;
  /** The bucket's length. */
  bucketSeconds: number;
  /** Null for a tier kept for good. */
  sourceTier: string | null;
  /** Every bucket starting before this is built; null when none is. */
  builtUntil: Moment | null;
};

type GraphQlTier = {
  name: string;
  bucket: string;
  sourceTier: string | null;
  builtUntil: string | null;
};

type GraphQlResult = { tier: string; rowsWritten: number; rowsPruned: number };

/**
 * The rollup and retention functions (migration 1790740000000), called
 * through Hasura like everything else the API does to the database. Each
 * rewrites whole buckets, so calling one again over the same range is
 * harmless; the schedule and replay both lean on that.
 */
@Injectable()
export class WeatherRollupService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** The tiers, finest first: the order they are built in. */
  async tiers(): Promise<RollupTier[]> {
    const document = gql`
      query ListWeatherRollupTiers {
        olympus_weather_rollup_tiers {
          name
          bucket
          sourceTier
          builtUntil
        }
      }
    `;
    type Result = { olympus_weather_rollup_tiers: GraphQlTier[] };
    const result = await this.graphQLClient.request<Result>(document);
    // Sorted here rather than by Hasura: an interval (Postgres writes
    // `00:05:00`) is not a type every Hasura version orders by.
    return result.olympus_weather_rollup_tiers
      .map((tier) => ({
        name: tier.name,
        bucketSeconds: moment.duration(tier.bucket).asSeconds(),
        sourceTier: tier.sourceTier,
        builtUntil: tier.builtUntil ? moment.utc(tier.builtUntil) : null,
      }))
      .sort((a, b) => a.bucketSeconds - b.bucketSeconds);
  }

  /** Builds `tier` over [from, to): from the samples, or its source tier. */
  async build(tier: RollupTier, from: Moment, to: Moment): Promise<number> {
    const [result] =
      tier.sourceTier === null
        ? await this.fromSamples(from, to)
        : await this.fromTier(tier.name, from, to);
    const written = result?.rowsWritten ?? 0;
    recordRollupRows(tier.name, "written", written);
    return written;
  }

  /**
   * Deletes samples observed before `sampleCutoff` and every tier's buckets
   * past its retention. Answers the rows removed, by tier (and `samples`).
   */
  async prune(sampleCutoff: Moment): Promise<Record<string, number>> {
    const document = gql`
      mutation PruneWeatherRollups($sampleCutoff: timestamptz!) {
        olympus_weather_prune(args: { sample_cutoff: $sampleCutoff }) {
          tier
          rowsWritten
          rowsPruned
        }
      }
    `;
    type Result = { olympus_weather_prune: GraphQlResult[] };
    const result = await this.graphQLClient.request<Result>(document, {
      sampleCutoff: sampleCutoff.toISOString(),
    });
    const pruned: Record<string, number> = {};
    for (const row of result.olympus_weather_prune) {
      pruned[row.tier] = row.rowsPruned;
      recordRollupRows(row.tier, "pruned", row.rowsPruned);
    }
    return pruned;
  }

  private async fromSamples(from: Moment, to: Moment) {
    const document = gql`
      mutation RollupWeatherSamples(
        $fromTime: timestamptz!
        $toTime: timestamptz!
      ) {
        olympus_weather_rollup_samples(
          args: { from_time: $fromTime, to_time: $toTime }
        ) {
          tier
          rowsWritten
          rowsPruned
        }
      }
    `;
    type Result = { olympus_weather_rollup_samples: GraphQlResult[] };
    const result = await this.graphQLClient.request<Result>(document, {
      fromTime: from.toISOString(),
      toTime: to.toISOString(),
    });
    return result.olympus_weather_rollup_samples;
  }

  private async fromTier(tier: string, from: Moment, to: Moment) {
    const document = gql`
      mutation RollupWeatherTier(
        $tier: String!
        $fromTime: timestamptz!
        $toTime: timestamptz!
      ) {
        olympus_weather_rollup_tier(
          args: { tier_name: $tier, from_time: $fromTime, to_time: $toTime }
        ) {
          tier
          rowsWritten
          rowsPruned
        }
      }
    `;
    type Result = { olympus_weather_rollup_tier: GraphQlResult[] };
    const result = await this.graphQLClient.request<Result>(document, {
      tier,
      fromTime: from.toISOString(),
      toTime: to.toISOString(),
    });
    return result.olympus_weather_rollup_tier;
  }
}
