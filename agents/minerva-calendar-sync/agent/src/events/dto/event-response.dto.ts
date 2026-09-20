import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  CanonicalCalendarEvent,
  EVENT_TYPE_VALUES,
  EventType,
  FREE_BUSY_STATUS_VALUES,
  FreeBusyStatus,
  IMPORTANCE_VALUES,
  Importance,
  OCCURRENCE_TYPE_VALUES,
  OccurrenceType,
  RESPONSE_VALUES,
  ResponseStatus,
  SENSITIVITY_VALUES,
  Sensitivity,
} from "../../domain/canonical-event";

/** Mirrors CanonicalCalendarEvent field-for-field, annotated for the generated OpenAPI spec. */
export class EventResponseDto implements CanonicalCalendarEvent {
  @ApiProperty() id: string;
  @ApiProperty() subject: string;
  @ApiProperty({ enum: SENSITIVITY_VALUES }) sensitivity: Sensitivity;
  @ApiProperty({ enum: IMPORTANCE_VALUES }) importance: Importance;
  @ApiProperty({ enum: OCCURRENCE_TYPE_VALUES }) occurrenceType: OccurrenceType;
  @ApiProperty({ enum: EVENT_TYPE_VALUES }) type: EventType;
  @ApiProperty() reminder: boolean;
  @ApiProperty({ enum: RESPONSE_VALUES }) response: ResponseStatus;
  @ApiProperty({ description: "ISO-8601" }) startTime: string;
  @ApiProperty({ description: "ISO-8601" }) endTime: string;
  @ApiProperty({ description: "Minutes" }) duration: number;
  @ApiProperty() allDay: boolean;
  @ApiProperty({ enum: FREE_BUSY_STATUS_VALUES }) status: FreeBusyStatus;
  @ApiPropertyOptional({ nullable: true, type: String }) location: string | null;
  @ApiProperty() cancelled: boolean;
  @ApiPropertyOptional({ nullable: true, type: String }) organizerEmail: string | null;
  @ApiProperty({ description: "Soft-delete flag" }) deleted: boolean;
  @ApiProperty() uid: string;
  @ApiPropertyOptional({ nullable: true, type: String }) recurrenceId: string | null;
  @ApiProperty() source: string;
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description:
      "The provider's own recurrence description (RRULE lines for Google, a serialized Graph recurrence pattern for Microsoft) — recorded for reference only, never parsed or expanded by this app",
  })
  recurrenceRule: string | null;
}
