import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import {
  SYNC_RUN_STATUS_VALUES,
  SYNC_RUN_TRIGGER_VALUES,
  SYNC_RUN_TYPE_VALUES,
  SyncRunStatus,
  SyncRunTrigger,
  SyncRunType,
} from "../../domain/syncRun";

/** The calendar/type/trigger/status filters shared by GET /sync-runs and GET /sync-runs/stats. */
export class SyncRunFilterQueryDto {
  @ApiPropertyOptional({
    description: "Filter to sync history for this configured calendar only",
  })
  @IsOptional()
  @IsString()
  calendarId?: string;

  @ApiPropertyOptional({ enum: SYNC_RUN_TYPE_VALUES })
  @IsOptional()
  @IsIn(SYNC_RUN_TYPE_VALUES)
  type?: SyncRunType;

  @ApiPropertyOptional({ enum: SYNC_RUN_TRIGGER_VALUES })
  @IsOptional()
  @IsIn(SYNC_RUN_TRIGGER_VALUES)
  trigger?: SyncRunTrigger;

  @ApiPropertyOptional({ enum: SYNC_RUN_STATUS_VALUES })
  @IsOptional()
  @IsIn(SYNC_RUN_STATUS_VALUES)
  status?: SyncRunStatus;
}
