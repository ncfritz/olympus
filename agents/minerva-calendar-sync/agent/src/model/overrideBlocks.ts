import { ApiTimestamp } from "@ncfritz/olympus-model";
import { ApiProperty, PickType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import type { Moment } from "moment";
import {
  AVAILABILITY_STATUS_VALUES,
  type AvailabilityStatus,
} from "../domain/availability";
import { AVAILABILITY_STATUS_ENUM } from "./common";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * A block of time on the internal "Overrides" calendar: it sets the
 * availability of everything it covers, whatever is synced underneath.
 */
export class OverrideBlock {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the override block",
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
    description:
      "An ISO-8601 formatted string indicating when the block ends (exclusive)",
  })
  endTime: Moment;

  @ApiProperty({
    ...AVAILABILITY_STATUS_ENUM,
    required: true,
    description: "The availability the block sets",
  })
  status: AvailabilityStatus;

  @ApiProperty({
    type: String,
    required: false,
    description: "A label shown on the block",
  })
  label?: string;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Partial and Derived Types                                                                                          */
/* ------------------------------------------------------------------------------------------------------------------ */

/** The fields of a new block. */
export class BaseOverrideBlock {
  @ApiProperty({
    type: String,
    required: true,
    description: "ISO-8601: when the block starts",
  })
  @IsISO8601()
  startTime: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "ISO-8601: when the block ends (exclusive)",
  })
  @IsISO8601()
  endTime: string;

  @ApiProperty({
    ...AVAILABILITY_STATUS_ENUM,
    required: true,
    description: "The availability the block sets",
  })
  @IsIn(AVAILABILITY_STATUS_VALUES)
  status: AvailabilityStatus;

  @ApiProperty({
    type: String,
    required: false,
    description: "A label shown on the block",
  })
  @IsOptional()
  @IsString()
  label?: string;
}

/** The fields of a block that can change: its status. */
export class PartialOverrideBlock extends PickType(BaseOverrideBlock, [
  "status",
]) {}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateOverrideBlockRequest {
  @ApiProperty({
    type: () => BaseOverrideBlock,
    required: true,
    description: "The block to create.",
  })
  @ValidateNested()
  @Type(() => BaseOverrideBlock)
  overrideBlock: BaseOverrideBlock;
}

export class ListOverrideBlocksQuery {
  @ApiProperty({
    type: String,
    required: true,
    description: "ISO-8601: the inclusive start of the range to list",
  })
  @IsISO8601()
  start: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "ISO-8601: the exclusive end of the range to list",
  })
  @IsISO8601()
  end: string;
}

export class UpdateOverrideBlockRequest {
  @ApiProperty({
    type: () => PartialOverrideBlock,
    required: true,
    description: "The changes to the block.",
  })
  @ValidateNested()
  @Type(() => PartialOverrideBlock)
  overrideBlock: PartialOverrideBlock;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateOverrideBlockResponse {
  @ApiProperty({
    type: () => OverrideBlock,
    required: true,
    description: "The created block.",
  })
  overrideBlock: OverrideBlock;
}

export class ListOverrideBlocksResponse {
  @ApiProperty({
    type: () => OverrideBlock,
    isArray: true,
    required: true,
    description: "The blocks overlapping the range.",
  })
  overrideBlocks: OverrideBlock[];
}

export class UpdateOverrideBlockResponse {
  @ApiProperty({
    type: () => OverrideBlock,
    required: true,
    description: "The block with the changes applied.",
  })
  overrideBlock: OverrideBlock;
}
