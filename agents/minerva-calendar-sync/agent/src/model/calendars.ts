import { ApiTimestamp } from "@ncfritz/olympus-model";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import type { Moment } from "moment";
import { CALENDAR_PROVIDER_ENUM, CALENDAR_PROVIDER_VALUES } from "./common";

type CalendarProviderName = (typeof CALENDAR_PROVIDER_VALUES)[number];

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** A synced calendar and its sync status. */
export class Calendar {
  @ApiProperty({
    ...CALENDAR_PROVIDER_ENUM,
    required: true,
    description: "The provider the calendar's account authorizes with",
  })
  provider: CalendarProviderName;

  @ApiProperty({
    type: String,
    required: true,
    description: "The connected account the calendar authorizes with",
  })
  accountLabel: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The provider's own ID of the calendar",
  })
  calendarId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The source label written onto the calendar's events",
  })
  source: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether at least one full sync has completed",
  })
  synced: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether a provider push-notification channel is configured for the calendar",
  })
  enablePush: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether the calendar syncs: a disabled calendar is skipped by polling, push and manual syncs alike",
  })
  enabled: boolean;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when a sync of the calendar last completed",
  })
  lastSyncedAt?: Moment;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether a sync of the calendar is running",
  })
  syncing: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether the calendar's events count toward the computed availability; off keeps a calendar (a shared holidays calendar, say) synced and visible without affecting it",
  })
  includedInBusy: boolean;
}

/** What a sync-to-downstream backfill of a calendar enqueued. */
export class CalendarBackfill {
  @ApiProperty({
    type: Number,
    required: true,
    description:
      "How many of the calendar's events were enqueued for publishing again",
  })
  enqueued: number;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether the calendar has more events than a backfill takes, so only part of them were enqueued",
  })
  truncated: boolean;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Partial and Derived Types                                                                                          */
/* ------------------------------------------------------------------------------------------------------------------ */

/** The fields of a calendar to add. */
export class BaseCalendar {
  // Required rather than inferred from accountLabel: the same email can be a
  // connected account under more than one provider.
  @ApiProperty({
    ...CALENDAR_PROVIDER_ENUM,
    required: true,
    description: "The provider the calendar's account authorizes with",
  })
  @IsIn(CALENDAR_PROVIDER_VALUES)
  provider: CalendarProviderName;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The connected account the calendar authorizes with; it must already be connected for this provider",
  })
  @IsString()
  @IsNotEmpty()
  accountLabel: string;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The provider's own ID of the calendar, from ListAvailableCalendars",
  })
  @IsString()
  @IsNotEmpty()
  calendarId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The source label to write onto the calendar's events",
  })
  @IsString()
  @IsNotEmpty()
  source: string;
}

/** The settings of a calendar that can change. */
export class PartialCalendar {
  @ApiProperty({
    type: Boolean,
    required: false,
    description: "Whether the calendar syncs",
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({
    type: Boolean,
    required: false,
    description:
      "Whether the calendar's events count toward the computed availability",
  })
  @IsOptional()
  @IsBoolean()
  includedInBusy?: boolean;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateCalendarRequest {
  @ApiProperty({
    type: () => BaseCalendar,
    required: true,
    description: "The calendar to add.",
  })
  @ValidateNested()
  @Type(() => BaseCalendar)
  calendar: BaseCalendar;
}

export class UpdateCalendarRequest {
  @ApiProperty({
    type: () => PartialCalendar,
    required: true,
    description: "The settings to change.",
  })
  @ValidateNested()
  @Type(() => PartialCalendar)
  calendar: PartialCalendar;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListCalendarsResponse {
  @ApiProperty({
    type: () => Calendar,
    isArray: true,
    required: true,
    description: "The synced calendars.",
  })
  calendars: Calendar[];
}

export class CreateCalendarResponse {
  @ApiProperty({
    type: () => Calendar,
    required: true,
    description: "The added calendar; its first sync runs in the background.",
  })
  calendar: Calendar;
}

export class UpdateCalendarResponse {
  @ApiProperty({
    type: () => Calendar,
    required: true,
    description: "The calendar with the changes applied.",
  })
  calendar: Calendar;
}

export class BackfillCalendarResponse {
  @ApiProperty({
    type: () => CalendarBackfill,
    required: true,
    description: "What the backfill enqueued.",
  })
  backfill: CalendarBackfill;
}
