import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { SyncRunDailyStat } from "../../domain/syncRun";
import type {
  FullSyncRun,
  GetSyncRunStatsQuery,
  ListSyncRunsQuery,
  SyncRun,
} from "../../model/syncRuns";
import { SYNC_RUN_STORE, type SyncRunStore } from "../../store/syncRunStore";
import { toDomainObject, toFullSyncRun } from "../converters/SyncRunConverter";

const DEFAULT_STATS_WINDOW_DAYS = 30;

/** The sync history. */
@Injectable()
export class SyncRunService {
  constructor(
    @Inject(SYNC_RUN_STORE) private readonly syncRuns: SyncRunStore,
  ) {}

  async list(query: ListSyncRunsQuery): Promise<SyncRun[]> {
    const runs = await this.syncRuns.list(query);
    return runs.map(toDomainObject);
  }

  /** One entry per day and calendar over the trailing window, for the Sync page's charts. */
  getStats(query: GetSyncRunStatsQuery): Promise<SyncRunDailyStat[]> {
    const { days = DEFAULT_STATS_WINDOW_DAYS, ...filter } = query;
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - (days - 1));
    since.setUTCHours(0, 0, 0, 0);

    return this.syncRuns.dailyStats({ ...filter, since: since.toISOString() });
  }

  async describe(syncRunId: string): Promise<FullSyncRun> {
    const run = await this.syncRuns.get(syncRunId);
    if (!run) {
      throw new NotFoundException(`Sync run with id ${syncRunId} not found`);
    }
    return toFullSyncRun(run);
  }
}
