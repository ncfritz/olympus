import {
  NewSyncRun,
  SyncRun,
  SyncRunDailyStat,
  SyncRunFilter,
  SyncRunStatsFilter,
  SyncRunWithChanges,
} from "../domain/syncRun";

/**
 * Persistence for the sync-history feature. SyncEngine writes through
 * `create` after every "meaningful" run; the Sync page's history view reads
 * through `list`/`get`, and its charts read through `dailyStats`.
 */
export interface SyncRunStore {
  create(run: NewSyncRun): Promise<SyncRun>;
  list(filter: SyncRunFilter): Promise<SyncRun[]>;
  get(id: string): Promise<SyncRunWithChanges | null>;
  /** One row per (day, calendar) with `since` and the same filters `list` supports — the Sync page's charts pivot this client-side rather than each chart hitting its own endpoint. */
  dailyStats(filter: SyncRunStatsFilter): Promise<SyncRunDailyStat[]>;
  /** Deletes every run that finished before `cutoff` (cascading to its event changes); returns how many were removed. */
  pruneFinishedBefore(cutoff: Date): Promise<number>;
}

/** Nest DI token — inject with `@Inject(SYNC_RUN_STORE)`. */
export const SYNC_RUN_STORE = Symbol("SYNC_RUN_STORE");
