import { ApiTimestamp } from "@ncfritz/olympus-model";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import type { Moment } from "moment";
import {
  SYNC_RUN_EVENT_ACTION_VALUES,
  SYNC_RUN_STATUS_VALUES,
  SYNC_RUN_TRIGGER_VALUES,
  SYNC_RUN_TYPE_VALUES,
  type SyncRunEventAction,
  type SyncRunStatus,
  type SyncRunTrigger,
  type SyncRunType,
} from "../domain/syncRun";

const SYNC_RUN_TYPE_ENUM = {
  enum: [...SYNC_RUN_TYPE_VALUES],
  enumName: "SyncRunType",
  enumSchema: {
    description:
      "Whether a sync re-fetched everything (full) or applied the changes since the last one (incremental)",
  },
};
const SYNC_RUN_TRIGGER_ENUM = {
  enum: [...SYNC_RUN_TRIGGER_VALUES],
  enumName: "SyncRunTrigger",
  enumSchema: { description: "What started a sync" },
};
const SYNC_RUN_STATUS_ENUM = {
  enum: [...SYNC_RUN_STATUS_VALUES],
  enumName: "SyncRunStatus",
  enumSchema: { description: "How a sync ended" },
};

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * One recorded sync of a calendar. Only meaningful runs are recorded:
 * something changed, it failed, or it was started by hand.
 */
export class SyncRun {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the sync run",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The provider's ID of the calendar synced",
  })
  calendarId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The source label the calendar's events are stored under",
  })
  source: string;

  @ApiProperty({
    ...SYNC_RUN_TYPE_ENUM,
    required: true,
    description: "Whether the run was full or incremental",
  })
  type: SyncRunType;

  @ApiProperty({
    ...SYNC_RUN_TRIGGER_ENUM,
    required: true,
    description: "What started the run",
  })
  trigger: SyncRunTrigger;

  @ApiProperty({
    ...SYNC_RUN_STATUS_ENUM,
    required: true,
    description: "How the run ended",
  })
  status: SyncRunStatus;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string indicating when the run started",
  })
  startedAt: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string indicating when the run ended",
  })
  finishedAt: Moment;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The number of events processed",
  })
  totalCount: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The number of events added",
  })
  addedCount: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The number of events updated",
  })
  updatedCount: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The number of events deleted",
  })
  deletedCount: number;

  @ApiProperty({
    type: String,
    required: false,
    description: "What went wrong, when the run failed",
  })
  errorMessage?: string;
}

/** An event a sync run added, updated or deleted. */
export class SyncRunEventChange {
  @ApiProperty({
    enum: [...SYNC_RUN_EVENT_ACTION_VALUES],
    enumName: "SyncRunEventAction",
    required: true,
    description: "What happened to the event",
  })
  action: SyncRunEventAction;

  @ApiProperty({
    type: String,
    required: true,
    description: "The ID of the event (source:uid)",
  })
  eventId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The event's title",
  })
  subject: string;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the event starts",
  })
  startTime?: Moment;
}

/** A sync run with the event changes it made. */
export class FullSyncRun extends SyncRun {
  @ApiProperty({
    type: () => SyncRunEventChange,
    isArray: true,
    required: true,
    description: "The events the run added, updated or deleted",
  })
  changes: SyncRunEventChange[];
}

/** One calendar's sync activity on one day. */
export class SyncRunDailyStat {
  @ApiProperty({
    type: String,
    required: true,
    description: "The day, as YYYY-MM-DD in UTC",
  })
  date: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The provider's ID of the calendar",
  })
  calendarId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The source label the calendar's events are stored under",
  })
  source: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The number of recorded runs that day",
  })
  runCount: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The number of those runs that succeeded",
  })
  successCount: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The number of those runs that failed",
  })
  errorCount: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The mean run duration in milliseconds",
  })
  avgDurationMs: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The events processed, summed over the day's runs",
  })
  totalCount: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The events added, summed over the day's runs",
  })
  addedCount: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The events updated, summed over the day's runs",
  })
  updatedCount: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The events deleted, summed over the day's runs",
  })
  deletedCount: number;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** The filters ListSyncRuns and GetSyncRunStats share. */
export class SyncRunFilterQuery {
  @ApiProperty({
    type: String,
    required: false,
    description: "Only runs of this calendar (the provider's ID)",
  })
  @IsOptional()
  @IsString()
  calendarId?: string;

  @ApiProperty({
    ...SYNC_RUN_TYPE_ENUM,
    required: false,
    description: "Only runs of this type",
  })
  @IsOptional()
  @IsIn(SYNC_RUN_TYPE_VALUES)
  type?: SyncRunType;

  @ApiProperty({
    ...SYNC_RUN_TRIGGER_ENUM,
    required: false,
    description: "Only runs started this way",
  })
  @IsOptional()
  @IsIn(SYNC_RUN_TRIGGER_VALUES)
  trigger?: SyncRunTrigger;

  @ApiProperty({
    ...SYNC_RUN_STATUS_ENUM,
    required: false,
    description: "Only runs that ended this way",
  })
  @IsOptional()
  @IsIn(SYNC_RUN_STATUS_VALUES)
  status?: SyncRunStatus;
}

export class ListSyncRunsQuery extends SyncRunFilterQuery {
  @ApiProperty({
    type: Number,
    required: false,
    minimum: 1,
    maximum: 200,
    default: 50,
    description: "The number of runs to return",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiProperty({
    type: String,
    required: false,
    description: "The ID of the run to page from (exclusive)",
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class GetSyncRunStatsQuery extends SyncRunFilterQuery {
  @ApiProperty({
    type: Number,
    required: false,
    minimum: 1,
    maximum: 90,
    default: 30,
    description: "The number of trailing days to cover",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListSyncRunsResponse {
  @ApiProperty({
    type: () => SyncRun,
    isArray: true,
    required: true,
    description: "The matching runs, newest first.",
  })
  syncRuns: SyncRun[];
}

export class GetSyncRunStatsResponse {
  @ApiProperty({
    type: () => SyncRunDailyStat,
    isArray: true,
    required: true,
    description: "One entry per day and calendar with runs.",
  })
  syncRunStats: SyncRunDailyStat[];
}

export class DescribeSyncRunResponse {
  @ApiProperty({
    type: () => FullSyncRun,
    required: true,
    description: "The run and its event changes.",
  })
  syncRun: FullSyncRun;
}
