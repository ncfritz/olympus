import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsISO8601, IsOptional, IsString } from "class-validator";
import {
  AVAILABILITY_STATUS_VALUES,
  AvailabilityStatus,
} from "../../domain/availability";

export class CreateOverrideBlockDto {
  @ApiProperty({ description: "ISO-8601" })
  @IsISO8601()
  startTime: string;

  @ApiProperty({ description: "ISO-8601" })
  @IsISO8601()
  endTime: string;

  @ApiProperty({ enum: AVAILABILITY_STATUS_VALUES })
  @IsIn(AVAILABILITY_STATUS_VALUES)
  status: AvailabilityStatus;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  label?: string;
}
