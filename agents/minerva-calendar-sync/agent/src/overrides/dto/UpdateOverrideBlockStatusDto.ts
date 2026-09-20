import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import {
  AVAILABILITY_STATUS_VALUES,
  AvailabilityStatus,
} from "../../domain/availability";

export class UpdateOverrideBlockStatusDto {
  @ApiProperty({ enum: AVAILABILITY_STATUS_VALUES })
  @IsIn(AVAILABILITY_STATUS_VALUES)
  status: AvailabilityStatus;
}
