import {
  ApiProperty,
  IntersectionType,
  PartialType,
  PickType,
} from "@nestjs/swagger";
import type { Moment } from "moment";
import { ApiTimestamp } from "../../decorators";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Enums                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

/** Where today falls against a cycle, in the caller's timezone. */
export enum GoalCycleStatus {
  Upcoming = "upcoming",
  Current = "current",
  Buffer = "buffer",
  Past = "past",
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * A 12-week cycle (ADR 0026): weeks of execution from a Monday, then buffer
 * weeks before the next. Cycles sit beside calendar quarters.
 */
export class GoalCycle {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the cycle",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The cycle's name, 1 to 50 characters, e.g. Cycle 4",
  })
  name: string;

  @ApiProperty({
    type: String,
    format: "date",
    required: true,
    description: "The day the cycle starts, a Monday, as YYYY-MM-DD",
  })
  startDate: string;

  @ApiProperty({
    type: Number,
    required: true,
    default: 12,
    description: "The number of weeks of execution, 1 to 26",
  })
  weeks: number;

  @ApiProperty({
    type: Number,
    required: true,
    default: 1,
    description: "The number of buffer weeks after the execution weeks, 0 to 2",
  })
  bufferWeeks: number;

  @ApiProperty({
    type: String,
    format: "date",
    required: true,
    description: "The last day of the execution weeks, a Sunday, as YYYY-MM-DD",
  })
  endDate: string;

  @ApiProperty({
    type: String,
    format: "date",
    required: true,
    description:
      "The last day of the buffer weeks, a Sunday, as YYYY-MM-DD; the end date when there are none",
  })
  bufferEndDate: string;

  @ApiProperty({
    enum: () => GoalCycleStatus,
    enumName: "GoalCycleStatus",
    required: true,
    description:
      "Where today falls against the cycle, in the caller's timezone",
  })
  status: GoalCycleStatus;

  @ApiProperty({
    type: Number,
    required: false,
    description:
      "Today's week of the cycle, from 1, while it is current or in its buffer; buffer weeks follow the execution weeks",
  })
  currentWeek?: number;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the cycle was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the cycle was last changed",
  })
  lastUpdatedTime?: Moment;
}

/** What is supplied to create a cycle; weeks default to 12 and 1. */
export class BaseGoalCycle extends IntersectionType(
  PickType(GoalCycle, ["name", "startDate"] as const),
  PartialType(PickType(GoalCycle, ["weeks", "bufferWeeks"] as const)),
) {}

/** The changes to a cycle; only what is named is changed. */
export class PartialGoalCycle extends PartialType(
  PickType(GoalCycle, ["name", "startDate", "weeks", "bufferWeeks"] as const),
) {}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateGoalCycleRequest {
  @ApiProperty({
    type: () => BaseGoalCycle,
    required: true,
    description: "The cycle to create.",
  })
  goalCycle: BaseGoalCycle;
}

export class UpdateGoalCycleRequest {
  @ApiProperty({
    type: () => PartialGoalCycle,
    required: true,
    description: "The changes to the cycle.",
  })
  goalCycle: PartialGoalCycle;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListGoalCyclesResponse {
  @ApiProperty({
    type: () => GoalCycle,
    isArray: true,
    required: true,
    description: "The caller's cycles, latest first.",
  })
  goalCycles: GoalCycle[];
}

export class DescribeGoalCycleResponse {
  @ApiProperty({
    type: () => GoalCycle,
    required: true,
    description: "The cycle.",
  })
  goalCycle: GoalCycle;
}

export class CreateGoalCycleResponse {
  @ApiProperty({
    type: () => GoalCycle,
    required: true,
    description: "The cycle as created.",
  })
  goalCycle: GoalCycle;
}

export class UpdateGoalCycleResponse {
  @ApiProperty({
    type: () => GoalCycle,
    required: true,
    description: "The cycle with the changes applied.",
  })
  goalCycle: GoalCycle;
}
