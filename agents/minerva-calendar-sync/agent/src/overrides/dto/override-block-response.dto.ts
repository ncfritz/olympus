import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AVAILABILITY_STATUS_VALUES, AvailabilityStatus, OverrideBlock } from "../../domain/availability";

export class OverrideBlockResponseDto implements OverrideBlock {
  @ApiProperty() id: string;
  @ApiProperty({ description: "ISO-8601" }) startTime: string;
  @ApiProperty({ description: "ISO-8601" }) endTime: string;
  @ApiProperty({ enum: AVAILABILITY_STATUS_VALUES }) status: AvailabilityStatus;
  @ApiPropertyOptional({ nullable: true, type: String }) label: string | null;
}
