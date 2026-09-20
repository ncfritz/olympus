import { ApiTimestamp } from "@ncfritz/olympus-model";
import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
} from "class-validator";
import type { Moment } from "moment";
import {
  AVAILABILITY_STATUS_VALUES,
  type AvailabilityStatus,
} from "../domain/availability";
import { AVAILABILITY_STATUS_ENUM } from "./common";

const toBoolean = ({ value }: { value: unknown }) =>
  value === "true" || value === true;
const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class AvailabilitySlot {
  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string indicating when the slot starts",
  })
  startTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the slot ends (exclusive)",
  })
  endTime: Moment;

  @ApiProperty({
    ...AVAILABILITY_STATUS_ENUM,
    required: true,
    description: "The combined availability during the slot",
  })
  status: AvailabilityStatus;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class GetFreeBusyQuery {
  @ApiProperty({
    type: String,
    required: true,
    description: "ISO-8601: the inclusive start of the computed range",
  })
  @IsISO8601()
  start: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "ISO-8601: the exclusive end of the computed range",
  })
  @IsISO8601()
  end: string;
}

export class GetStatusTimelineQuery extends GetFreeBusyQuery {
  @ApiProperty({
    type: String,
    required: false,
    default: "08:00",
    description:
      "HH:mm, 24-hour, in `timezone`: the start of the working-hours window",
  })
  @IsOptional()
  @Matches(TIME_OF_DAY_PATTERN, { message: "dayStart must be HH:mm" })
  dayStart?: string;

  @ApiProperty({
    type: String,
    required: false,
    default: "18:00",
    description:
      "HH:mm, 24-hour, in `timezone`: the end of the working-hours window (exclusive)",
  })
  @IsOptional()
  @Matches(TIME_OF_DAY_PATTERN, { message: "dayEnd must be HH:mm" })
  dayEnd?: string;

  @ApiProperty({
    type: Boolean,
    required: false,
    default: false,
    description:
      'Whether Saturday and Sunday are computed like weekdays instead of as "none" (except where an override applies)',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  treatWeekendsAsWorking?: boolean;

  @ApiProperty({
    type: String,
    required: false,
    default: "UTC",
    description:
      'The IANA time zone (e.g. "America/Los_Angeles") dayStart, dayEnd and the weekday are evaluated in',
  })
  @IsOptional()
  @IsString()
  timezone?: string;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class GetFreeBusyResponse {
  @ApiProperty({
    type: () => AvailabilitySlot,
    isArray: true,
    required: true,
    description: "The 15-minute slots of the range, in order",
  })
  slots: AvailabilitySlot[];
}

export class GetStatusTimelineResponse {
  @ApiProperty({
    type: Object,
    additionalProperties: {
      type: "string",
      enum: [...AVAILABILITY_STATUS_VALUES],
    },
    required: true,
    description:
      "The status of each 15-minute chunk of the range, keyed by the chunk's start in minutes since the epoch",
    example: { "28564020": "busy", "28564035": "none" },
  })
  timeline: Record<string, AvailabilityStatus>;
}
