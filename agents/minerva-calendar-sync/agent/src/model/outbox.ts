import { ApiTimestamp } from "@ncfritz/olympus-model";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import type { Moment } from "moment";
import {
  OUTBOX_ACTION_VALUES,
  OUTBOX_STATUS_VALUES,
  type OutboxAction,
  type OutboxStatus,
} from "../domain/outbox";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** An event change queued for publishing to RabbitMQ (a row of the transactional outbox). */
export class OutboxEvent {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the outbox event",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The ID of the calendar event it describes (source:uid)",
  })
  eventId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The source label of the calendar event",
  })
  source: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The calendar event's title, at the time of the change",
  })
  subject: string;

  @ApiProperty({
    enum: [...OUTBOX_ACTION_VALUES],
    enumName: "OutboxAction",
    required: true,
    description:
      "What is published: upsert, delete, or backfill (a resend of the current state)",
  })
  action: OutboxAction;

  @ApiProperty({
    enum: [...OUTBOX_STATUS_VALUES],
    enumName: "OutboxStatus",
    required: true,
    description: "Whether it is waiting, was published, or gave up",
  })
  status: OutboxStatus;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The number of publishing attempts made",
  })
  attempts: number;

  @ApiProperty({
    type: String,
    required: false,
    description: "Why the last attempt failed",
  })
  lastError?: string;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string indicating when it was queued",
  })
  createdAt: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when it was published",
  })
  sentAt?: Moment;
}

/** The outbox activity of one source. */
export class OutboxSourceSummary {
  @ApiProperty({
    type: String,
    required: true,
    description: "The source label",
  })
  source: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "The provider's ID of the source's calendar, while it is still synced",
  })
  calendarId?: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The number of events waiting to be published",
  })
  pending: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The number of events published",
  })
  sent: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The number of events that gave up",
  })
  failed: number;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the oldest waiting event was queued; a growing age means something downstream is stuck",
  })
  oldestPendingAt?: Moment;
}

/** The outbox at a glance, for the Publish page. */
export class OutboxSummary {
  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether publishing is enabled (OUTBOX_ENABLED)",
  })
  enabled: boolean;

  @ApiProperty({
    type: () => OutboxSourceSummary,
    isArray: true,
    required: true,
    description:
      "One entry per synced calendar, plus sources with outbox activity whose calendar is gone",
  })
  sources: OutboxSourceSummary[];
}

/** Whether and how a calendar event was published. */
export class EventPublishStatus {
  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether publishing is enabled (OUTBOX_ENABLED)",
  })
  enabled: boolean;

  @ApiProperty({
    type: () => OutboxEvent,
    required: false,
    description:
      "The event's latest outbox event; absent when it was never queued (it predates publishing, say)",
  })
  latest?: OutboxEvent;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListFailedOutboxEventsQuery {
  @ApiProperty({
    type: Number,
    required: false,
    minimum: 1,
    maximum: 200,
    default: 50,
    description: "The number of outbox events to return",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class GetOutboxSummaryResponse {
  @ApiProperty({
    type: () => OutboxSummary,
    required: true,
    description: "The outbox summary.",
  })
  outboxSummary: OutboxSummary;
}

export class ListFailedOutboxEventsResponse {
  @ApiProperty({
    type: () => OutboxEvent,
    isArray: true,
    required: true,
    description: "The outbox events that gave up, newest first.",
  })
  outboxEvents: OutboxEvent[];
}

export class GetEventPublishStatusResponse {
  @ApiProperty({
    type: () => EventPublishStatus,
    required: true,
    description: "The event's publish status.",
  })
  eventPublishStatus: EventPublishStatus;
}
