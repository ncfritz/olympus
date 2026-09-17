import { ApiProperty } from "@nestjs/swagger";

export class CalendarStatusDto {
  @ApiProperty({ description: "Which CalendarProvider implementation this calendar uses" })
  provider: string;

  @ApiProperty({ description: "Which stored OAuth credential this calendar authorizes with" })
  accountLabel: string;

  @ApiProperty({ description: "The provider's own calendar id" })
  calendarId: string;

  @ApiProperty({ description: "The source label written onto this calendar's event rows" })
  source: string;

  @ApiProperty({ description: "True once at least one full sync has completed" })
  synced: boolean;

  @ApiProperty({ description: "Whether a Google push notification channel is configured for this calendar" })
  enablePush: boolean;

  @ApiProperty({ description: "Whether this calendar's sync is turned on — a disabled calendar is skipped by polling, push, and manual sync alike" })
  enabled: boolean;

  @ApiProperty({ description: "When a full or incremental sync last completed for this calendar", required: false })
  lastSyncedAt?: string;

  @ApiProperty({ description: "False for a calendar declared via SYNCED_CALENDARS — only removable through the API otherwise" })
  removable: boolean;

  @ApiProperty({ description: "True while a sync (from any trigger — poll, push, or manual) is in progress for this calendar" })
  syncing: boolean;

  @ApiProperty({
    description:
      "Whether this calendar's events count toward the busy/free calculation (GET /freebusy, /freebusy/timeline) — " +
      "off lets a calendar stay synced and visible without affecting computed availability, e.g. a shared holidays calendar",
  })
  includedInBusy: boolean;
}
