import { ApiProperty } from "@nestjs/swagger";
import { AVAILABILITY_STATUS_VALUES, AvailabilitySlot, AvailabilityStatus } from "../../domain/availability";

export class AvailabilitySlotDto implements AvailabilitySlot {
  @ApiProperty({ description: "ISO-8601" }) startTime: string;
  @ApiProperty({ description: "ISO-8601" }) endTime: string;
  @ApiProperty({ enum: AVAILABILITY_STATUS_VALUES }) status: AvailabilityStatus;
}
