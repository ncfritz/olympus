import moment from "moment";
import type {
  SyncRun as DomainSyncRun,
  SyncRunEventChange as DomainSyncRunEventChange,
  SyncRunWithChanges,
} from "../../domain/syncRun";
import type {
  FullSyncRun,
  SyncRun,
  SyncRunEventChange,
} from "../../model/syncRuns";

/** A recorded sync run as the management API returns it. */
export const toDomainObject = (run: DomainSyncRun): SyncRun => ({
  id: run.id,
  calendarId: run.calendarId,
  source: run.source,
  type: run.type,
  trigger: run.trigger,
  status: run.status,
  startedAt: moment.utc(run.startedAt),
  finishedAt: moment.utc(run.finishedAt),
  totalCount: run.totalCount,
  addedCount: run.addedCount,
  updatedCount: run.updatedCount,
  deletedCount: run.deletedCount,
  errorMessage: run.errorMessage ?? undefined,
});

const buildChange = (change: DomainSyncRunEventChange): SyncRunEventChange => ({
  action: change.action,
  eventId: change.eventId,
  subject: change.subject,
  startTime: change.startTime ? moment.utc(change.startTime) : undefined,
});

export const toFullSyncRun = (run: SyncRunWithChanges): FullSyncRun => ({
  ...toDomainObject(run),
  changes: run.changes.map(buildChange),
});
