import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SyncRunDto {
  @ApiProperty({ description: "Sync history entry id" })
  id: string;

  @ApiProperty({ description: "The provider's own calendar id this run synced" })
  calendarId: string;

  @ApiProperty({ description: "The source label this calendar's events are stored under" })
  source: string;

  @ApiProperty({ enum: ["full", "incremental"], description: "Whether this run re-fetched everything or applied a delta" })
  type: string;

  @ApiProperty({ enum: ["manual", "poll", "webhook"], description: "What kicked this run off" })
  trigger: string;

  @ApiProperty({ enum: ["success", "error"] })
  status: string;

  @ApiProperty()
  startedAt: string;

  @ApiProperty()
  finishedAt: string;

  @ApiProperty({ description: "Events processed during this run" })
  totalCount: number;

  @ApiProperty()
  addedCount: number;

  @ApiProperty()
  updatedCount: number;

  @ApiProperty()
  deletedCount: number;

  @ApiPropertyOptional({ nullable: true, type: String })
  errorMessage: string | null;
}

export class SyncRunEventChangeDto {
  @ApiProperty({ enum: ["added", "updated", "deleted"] })
  action: string;

  @ApiProperty({ description: "The canonical event id (source:uid) this change applied to" })
  eventId: string;

  @ApiProperty()
  subject: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  startTime: string | null;
}

export class SyncRunDetailDto extends SyncRunDto {
  @ApiProperty({ type: SyncRunEventChangeDto, isArray: true })
  changes: SyncRunEventChangeDto[];
}

export class SyncRunDailyStatDto {
  @ApiProperty({ description: "YYYY-MM-DD, UTC" })
  date: string;

  @ApiProperty({ description: "The provider's own calendar id this day's stats are for" })
  calendarId: string;

  @ApiProperty({ description: "The source label this calendar's events are stored under" })
  source: string;

  @ApiProperty({ description: "How many sync attempts ran against this calendar this day" })
  runCount: number;

  @ApiProperty()
  successCount: number;

  @ApiProperty()
  errorCount: number;

  @ApiProperty({ description: "Mean run duration in milliseconds, across this day's runs" })
  avgDurationMs: number;

  @ApiProperty({ description: "Events processed, summed across this day's runs" })
  totalCount: number;

  @ApiProperty()
  addedCount: number;

  @ApiProperty()
  updatedCount: number;

  @ApiProperty()
  deletedCount: number;
}
