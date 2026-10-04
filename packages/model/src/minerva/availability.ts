import { ApiProperty } from "@nestjs/swagger";
import type { Moment } from "moment";
import { ApiTimestamp } from "../decorators";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Enums                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * How interruptible the user is (ADR 0029), lowest to highest. Where
 * several things overlap, the highest wins.
 */
export enum AvailabilityLevel {
  /** Not working: outside the working day, out of office. */
  None = "none",
  Free = "free",
  Interruptable = "interruptable",
  Busy = "busy",
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** A span of time with a level the user set, whatever meetings fall in it. */
export class AvailabilityBlock {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the block",
  })
  id: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the block starts",
  })
  startTime: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string indicating when the block ends",
  })
  endTime: Moment;

  @ApiProperty({
    enum: () => AvailabilityLevel,
    enumName: "AvailabilityLevel",
    enumSchema: {
      description:
        "How interruptible the user is, lowest to highest: none, free, interruptable, busy",
    },
    required: true,
    description: "The level the block sets",
  })
  status: AvailabilityLevel;

  @ApiProperty({
    type: String,
    required: false,
    description: "What the block is for",
  })
  label?: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the block was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the block last changed",
  })
  lastUpdatedTime: Moment;
}

/** One of the user's meetings, with the level it counts for. */
export class MeetingAvailability {
  @ApiProperty({
    type: String,
    required: true,
    description: "The ID of the meeting",
  })
  meetingId: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The meeting's subject",
  })
  subject?: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the meeting starts",
  })
  startTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the meeting ends",
  })
  endTime: Moment;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The meeting's free/busy status from its calendar: Busy, Tentative, Free, OOF or WorkingElsewhere",
  })
  calendarStatus: string;

  @ApiProperty({
    enum: () => AvailabilityLevel,
    enumName: "AvailabilityLevel",
    enumSchema: {
      description:
        "How interruptible the user is, lowest to highest: none, free, interruptable, busy",
    },
    required: true,
    description:
      "The level the meeting counts for: the one the user set, else its calendar status's",
  })
  status: AvailabilityLevel;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether the user set the meeting's level",
  })
  overridden: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether the meeting counts toward availability (its calendar counts toward busy)",
  })
  counted: boolean;
}

/** The level of one 15-minute slot. */
export class AvailabilitySlot {
  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string indicating when the slot starts",
  })
  startTime: Moment;

  @ApiProperty({
    enum: () => AvailabilityLevel,
    enumName: "AvailabilityLevel",
    enumSchema: {
      description:
        "How interruptible the user is, lowest to highest: none, free, interruptable, busy",
    },
    required: true,
    description: "The slot's level",
  })
  status: AvailabilityLevel;
}

/** The user's availability over a range. */
export class Availability {
  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating where the range starts, on a 15-minute boundary",
  })
  startTime: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string indicating where the range ends",
  })
  endTime: Moment;

  @ApiProperty({
    type: () => AvailabilitySlot,
    isArray: true,
    required: true,
    description: "Every 15-minute slot of the range, in order",
  })
  slots: AvailabilitySlot[];

  @ApiProperty({
    type: () => MeetingAvailability,
    isArray: true,
    required: true,
    description: "The user's meetings in the range, by start",
  })
  meetings: MeetingAvailability[];

  @ApiProperty({
    type: () => AvailabilityBlock,
    isArray: true,
    required: true,
    description: "The user's blocks in the range, by start",
  })
  blocks: AvailabilityBlock[];
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Partial and Derived Types                                                                                          */
/* ------------------------------------------------------------------------------------------------------------------ */

export class BaseAvailabilityBlock {
  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the block starts",
  })
  startTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the block ends; after its start",
  })
  endTime: Moment;

  @ApiProperty({
    enum: () => AvailabilityLevel,
    enumName: "AvailabilityLevel",
    enumSchema: {
      description:
        "How interruptible the user is, lowest to highest: none, free, interruptable, busy",
    },
    required: true,
    description: "The level the block sets",
  })
  status: AvailabilityLevel;

  @ApiProperty({
    type: String,
    required: false,
    description: "What the block is for, at most 200 characters",
  })
  label?: string;
}

export class PartialAvailabilityBlock {
  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the block starts",
  })
  startTime?: Moment;

  @ApiTimestamp({
    required: false,
    description: "An ISO-8601 formatted string indicating when the block ends",
  })
  endTime?: Moment;

  @ApiProperty({
    enum: () => AvailabilityLevel,
    enumName: "AvailabilityLevel",
    enumSchema: {
      description:
        "How interruptible the user is, lowest to highest: none, free, interruptable, busy",
    },
    required: false,
    description: "The level the block sets",
  })
  status?: AvailabilityLevel;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: "What the block is for; null removes it",
  })
  label?: string | null;
}

export class MeetingAvailabilityChange {
  @ApiProperty({
    enum: () => AvailabilityLevel,
    enumName: "AvailabilityLevel",
    enumSchema: {
      description:
        "How interruptible the user is, lowest to highest: none, free, interruptable, busy",
    },
    required: true,
    description: "The level the meeting counts for, whatever its calendar says",
  })
  status: AvailabilityLevel;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateAvailabilityBlockRequest {
  @ApiProperty({
    type: () => BaseAvailabilityBlock,
    required: true,
    description: "The block to create.",
  })
  block: BaseAvailabilityBlock;
}

export class UpdateAvailabilityBlockRequest {
  @ApiProperty({
    type: () => PartialAvailabilityBlock,
    required: true,
    description: "The changes to the block.",
  })
  block: PartialAvailabilityBlock;
}

export class SetMeetingAvailabilityRequest {
  @ApiProperty({
    type: () => MeetingAvailabilityChange,
    required: true,
    description: "The meeting's level.",
  })
  availability: MeetingAvailabilityChange;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class GetAvailabilityResponse {
  @ApiProperty({
    type: () => Availability,
    required: true,
    description: "The caller's availability over the range.",
  })
  availability: Availability;
}

export class ListAvailabilityBlocksResponse {
  @ApiProperty({
    type: () => AvailabilityBlock,
    isArray: true,
    required: true,
    description: "The caller's blocks in the range.",
  })
  blocks: AvailabilityBlock[];
}

export class SingleAvailabilityBlockResponse {
  @ApiProperty({
    type: () => AvailabilityBlock,
    required: true,
    description: "The block.",
  })
  block: AvailabilityBlock;
}

export class SingleMeetingAvailabilityResponse {
  @ApiProperty({
    type: () => MeetingAvailability,
    required: true,
    description: "The meeting, with the level it now counts for.",
  })
  meeting: MeetingAvailability;
}
