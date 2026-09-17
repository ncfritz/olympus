export const SYNC_RUN_TYPE_VALUES = ["full", "incremental"] as const;
export type SyncRunType = (typeof SYNC_RUN_TYPE_VALUES)[number];

export const SYNC_RUN_TRIGGER_VALUES = ["manual", "poll", "webhook"] as const;
export type SyncRunTrigger = (typeof SYNC_RUN_TRIGGER_VALUES)[number];

export const SYNC_RUN_STATUS_VALUES = ["success", "error"] as const;
export type SyncRunStatus = (typeof SYNC_RUN_STATUS_VALUES)[number];

export const SYNC_RUN_EVENT_ACTION_VALUES = ["added", "updated", "deleted"] as const;
export type SyncRunEventAction = (typeof SYNC_RUN_EVENT_ACTION_VALUES)[number];

/** One event actually added, updated, or deleted by a SyncRun. */
export interface SyncRunEventChange {
  action: SyncRunEventAction;
  eventId: string;
  subject: string;
  startTime: string | null;
}

/** A completed attempt to sync one calendar — every attempt against the provider gets one, poll/push no-ops included; see SyncEngine. */
export interface SyncRun {
  id: string;
  calendarId: string;
  source: string;
  type: SyncRunType;
  trigger: SyncRunTrigger;
  status: SyncRunStatus;
  startedAt: string;
  finishedAt: string;
  totalCount: number;
  addedCount: number;
  updatedCount: number;
  deletedCount: number;
  errorMessage: string | null;
}

export interface SyncRunWithChanges extends SyncRun {
  changes: SyncRunEventChange[];
}

export type NewSyncRun = Omit<SyncRun, "id"> & { changes: SyncRunEventChange[] };

export interface SyncRunFilter {
  calendarId?: string;
  type?: SyncRunType;
  trigger?: SyncRunTrigger;
  status?: SyncRunStatus;
  limit?: number;
  cursor?: string;
}

export interface SyncRunStatsFilter {
  calendarId?: string;
  type?: SyncRunType;
  trigger?: SyncRunTrigger;
  status?: SyncRunStatus;
  /** Inclusive lower bound — only runs that started on or after this instant are included. */
  since: string;
}

/** One calendar's aggregated activity for one UTC day — the unit the Sync page's charts are built from. */
export interface SyncRunDailyStat {
  /** YYYY-MM-DD, UTC. */
  date: string;
  calendarId: string;
  source: string;
  runCount: number;
  successCount: number;
  errorCount: number;
  avgDurationMs: number;
  totalCount: number;
  addedCount: number;
  updatedCount: number;
  deletedCount: number;
}
