import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import moment, { type Moment } from "moment";
import {
  weatherConfig,
  type WeatherConfigType,
} from "../../../config/configuration";
import { recordRollupLag } from "../weatherMetrics";
import { type RollupTier, WeatherRollupService } from "./WeatherRollupService";
import { WeatherReplayService } from "./WeatherReplayService";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
/** A minute is built once it has been over this long, for late pushes. */
const SETTLE_MS = 30_000;
/** Warnings about a failing run, at most this often. */
const LOG_EVERY_MS = 10 * MINUTE_MS;

/**
 * Keeps the tiers built and pruned (ADR 0024, plan phase 6), when
 * `WEATHER_ROLLUPS_ENABLED`; one API per database should.
 *
 * Every minute, each tier is built from where it stopped (`built_until`)
 * up to what its source has: the 1m tier up to the last minute that ended
 * at least 30 seconds ago, each coarser tier up to its source's
 * `built_until`. So a coarse tier follows its source by up to one of its
 * own buckets, and after an outage every tier catches up in one run from
 * where it stopped. Hourly, retention runs, and keeps samples the 1m tier
 * has not reached yet.
 *
 * A run that is still going when the next is due is not overlapped, and
 * neither runs while a replay does: a replay builds and prunes as it goes.
 */
@Injectable()
export class WeatherRollupScheduler
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(WeatherRollupScheduler.name);
  private readonly timers: NodeJS.Timeout[] = [];
  private busy = false;
  private lastWarned = 0;

  constructor(
    private readonly rollups: WeatherRollupService,
    private readonly replays: WeatherReplayService,
    @Inject(weatherConfig.KEY) private readonly weather: WeatherConfigType,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.weather.stations.rollupsEnabled) {
      this.logger.log(
        "Station rollups are off here (WEATHER_ROLLUPS_ENABLED=false)",
      );
      return;
    }
    this.timers.push(
      setInterval(() => void this.tick(() => this.build()), MINUTE_MS),
      setInterval(() => void this.tick(() => this.prune()), HOUR_MS),
    );
    for (const timer of this.timers) timer.unref();
  }

  onApplicationShutdown(): void {
    for (const timer of this.timers) clearInterval(timer);
    this.timers.length = 0;
  }

  /** Brings every tier up to date. Exposed for the tests. */
  async build(now: Moment = moment.utc()): Promise<void> {
    const tiers = await this.rollups.tiers();
    const byName = new Map(tiers.map((tier) => [tier.name, tier]));
    const floor = now
      .clone()
      .subtract(this.weather.stations.sampleRetentionHours, "hours");

    for (const tier of tiers) {
      const to =
        tier.sourceTier === null
          ? moment.utc(now.valueOf() - SETTLE_MS)
          : byName.get(tier.sourceTier)?.builtUntil;
      if (!to) continue;
      const from = startFor(tier, floor);
      if (from.isBefore(to)) {
        await this.rollups.build(tier, from, to);
        // What the database will have set built_until to: whole buckets.
        tier.builtUntil = moment.max(
          tier.builtUntil ?? from,
          alignDown(to, tier.bucketSeconds),
        );
      }
      if (tier.builtUntil) {
        recordRollupLag(
          tier.name,
          Math.max(now.diff(tier.builtUntil, "seconds"), 0),
        );
      }
    }
  }

  /**
   * Samples past their retention, and each tier past its. Samples the 1m
   * tier has not been built from yet are kept whatever their age (the
   * database was away, or this API was), as is the day before them, which
   * the rain is measured against.
   */
  async prune(now: Moment = moment.utc()): Promise<void> {
    const retention = now
      .clone()
      .subtract(this.weather.stations.sampleRetentionHours, "hours");
    const finest = (await this.rollups.tiers()).find(
      (tier) => tier.sourceTier === null,
    );
    const unbuilt = finest?.builtUntil
      ? finest.builtUntil.clone().subtract(1, "day")
      : undefined;
    await this.rollups.prune(
      unbuilt ? moment.min(retention, unbuilt) : retention,
    );
  }

  private async tick(run: () => Promise<void>): Promise<void> {
    if (this.busy || this.replays.running) return;
    this.busy = true;
    try {
      await run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (Date.now() - this.lastWarned >= LOG_EVERY_MS) {
        this.lastWarned = Date.now();
        this.logger.warn(`Station rollups failed: ${message}`);
      } else {
        this.logger.debug(`Station rollups failed: ${message}`);
      }
    } finally {
      this.busy = false;
    }
  }
}

/**
 * Where a tier's build starts: its built_until, a bucket back so the last
 * bucket is rebuilt with anything that arrived late. A tier never built
 * starts as far back as samples are kept; anything older is a replay's.
 */
const startFor = (tier: RollupTier, floor: Moment): Moment =>
  alignDown(
    tier.builtUntil
      ? tier.builtUntil.clone().subtract(tier.bucketSeconds, "seconds")
      : floor,
    tier.bucketSeconds,
  );

const alignDown = (at: Moment, bucketSeconds: number): Moment =>
  moment.utc(
    Math.floor(at.valueOf() / (bucketSeconds * 1000)) * bucketSeconds * 1000,
  );
