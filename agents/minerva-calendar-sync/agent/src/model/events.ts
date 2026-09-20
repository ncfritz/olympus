import { ApiTimestamp } from "@ncfritz/olympus-model";
import { ApiProperty, PickType } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import type { Moment } from "moment";
import {
  AVAILABILITY_STATUS_VALUES,
  type AvailabilityStatus,
} from "../domain/availability";
import {
  EVENT_TYPE_VALUES,
  type EventType,
  FREE_BUSY_STATUS_VALUES,
  type FreeBusyStatus,
  IMPORTANCE_VALUES,
  type Importance,
  OCCURRENCE_TYPE_VALUES,
  type OccurrenceType,
  RESPONSE_VALUES,
  type ResponseStatus,
  SENSITIVITY_VALUES,
  type Sensitivity,
} from "../domain/canonicalEvent";
import { AVAILABILITY_STATUS_ENUM } from "./common";

const toBoolean = ({ value }: { value: unknown }) =>
  value === "true" || value === true;

const OCCURRENCE_TYPE_ENUM = {
  enum: [...OCCURRENCE_TYPE_VALUES],
  enumName: "OccurrenceType",
  enumSchema: {
    description:
      "Whether an event stands alone or belongs to a recurring series",
  },
};

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** A synced calendar event, normalized across providers. */
export class Event {
  @ApiProperty({
    type: String,
    required: true,
    description:
      "The unique ID of the event: its source and uid, as source:uid",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The event's title",
  })
  subject: string;

  @ApiProperty({
    enum: [...SENSITIVITY_VALUES],
    enumName: "Sensitivity",
    required: true,
    description: "How private the event is",
  })
  sensitivity: Sensitivity;

  @ApiProperty({
    enum: [...IMPORTANCE_VALUES],
    enumName: "Importance",
    required: true,
    description: "The event's importance",
  })
  importance: Importance;

  @ApiProperty({
    ...OCCURRENCE_TYPE_ENUM,
    required: true,
    description: "Whether the event is a single event or an occurrence",
  })
  occurrenceType: OccurrenceType;

  @ApiProperty({
    enum: [...EVENT_TYPE_VALUES],
    enumName: "EventType",
    required: true,
    description: "The kind of event",
  })
  type: EventType;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether a reminder is set",
  })
  reminder: boolean;

  @ApiProperty({
    enum: [...RESPONSE_VALUES],
    enumName: "ResponseStatus",
    required: true,
    description: "The account owner's response to the event",
  })
  response: ResponseStatus;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the event starts (midnight UTC of its date for all-day events)",
  })
  startTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the event ends (exclusive)",
  })
  endTime: Moment;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The event's length in minutes",
  })
  duration: number;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether the event lasts whole days",
  })
  allDay: boolean;

  @ApiProperty({
    enum: [...FREE_BUSY_STATUS_VALUES],
    enumName: "FreeBusyStatus",
    required: true,
    description: "How the event shows the owner's time in the provider",
  })
  status: FreeBusyStatus;

  @ApiProperty({
    type: String,
    required: false,
    description: "Where the event takes place",
  })
  location?: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether the event was cancelled",
  })
  cancelled: boolean;

  @ApiProperty({
    type: String,
    required: false,
    description: "The organizer's email address",
  })
  organizerEmail?: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether the event was removed from its calendar",
  })
  deleted: boolean;

  @ApiProperty({
    type: String,
    required: true,
    description: "The provider's ID of the event",
  })
  uid: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The provider's ID of the occurrence within its series",
  })
  recurrenceId?: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The label of the calendar the event came from",
  })
  source: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "The provider's own recurrence description (RRULE lines for Google, a serialized Graph recurrence pattern for Microsoft), recorded for reference only",
  })
  recurrenceRule?: string;
}

/** A per-event availability override: the status the event counts as. */
export class EventOverride {
  @ApiProperty({
    type: String,
    required: true,
    description: "The ID of the event the override applies to",
  })
  eventId: string;

  @ApiProperty({
    ...AVAILABILITY_STATUS_ENUM,
    required: true,
    description: "The availability the event counts as",
  })
  @IsIn(AVAILABILITY_STATUS_VALUES)
  status: AvailabilityStatus;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Partial and Derived Types                                                                                          */
/* ------------------------------------------------------------------------------------------------------------------ */

export class PartialEventOverride extends PickType(EventOverride, ["status"]) {}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListEventsQuery {
  @ApiProperty({
    type: String,
    required: false,
    description: "Only events from this calendar source label",
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "ISO-8601: only events starting at or after this instant",
  })
  @IsOptional()
  @IsISO8601()
  startsAfter?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "ISO-8601: only events starting at or before this instant",
  })
  @IsOptional()
  @IsISO8601()
  startsBefore?: string;

  @ApiProperty({
    type: Boolean,
    required: false,
    description: "Only cancelled (true) or only not cancelled (false) events",
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  cancelled?: boolean;

  @ApiProperty({
    type: Boolean,
    required: false,
    description: "Only deleted (true) or only not deleted (false) events",
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  deleted?: boolean;

  @ApiProperty({
    ...OCCURRENCE_TYPE_ENUM,
    required: false,
    description: "Only events of this occurrence type",
  })
  @IsOptional()
  @IsIn(OCCURRENCE_TYPE_VALUES)
  occurrenceType?: OccurrenceType;

  @ApiProperty({
    type: Number,
    required: false,
    minimum: 1,
    maximum: 1000,
    default: 100,
    description: "The number of events to return",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;

  @ApiProperty({
    type: String,
    required: false,
    description: "The ID of the event to page from (exclusive)",
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class ListEventOverridesQuery {
  @ApiProperty({
    type: String,
    required: true,
    description: "Comma-separated IDs of the events to look up",
  })
  @IsString()
  ids: string;
}

export class UpdateEventOverrideRequest {
  @ApiProperty({
    type: () => PartialEventOverride,
    required: true,
    description: "The override to set.",
  })
  @ValidateNested()
  @Type(() => PartialEventOverride)
  eventOverride: PartialEventOverride;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListEventsResponse {
  @ApiProperty({
    type: () => Event,
    isArray: true,
    required: true,
    description: "The matching events.",
  })
  events: Event[];
}

export class DescribeEventResponse {
  @ApiProperty({
    type: () => Event,
    required: true,
    description: "The event.",
  })
  event: Event;
}

export class ListEventOverridesResponse {
  @ApiProperty({
    type: () => EventOverride,
    isArray: true,
    required: true,
    description: "The overrides of those events that have one.",
  })
  eventOverrides: EventOverride[];
}

export class DescribeEventOverrideResponse {
  @ApiProperty({
    type: () => EventOverride,
    required: true,
    description: "The event's override.",
  })
  eventOverride: EventOverride;
}

export class UpdateEventOverrideResponse {
  @ApiProperty({
    type: () => EventOverride,
    required: true,
    description: "The override as stored.",
  })
  eventOverride: EventOverride;
}
