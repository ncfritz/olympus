import { ApiProperty } from "@nestjs/swagger";
import { AVAILABILITY_STATUS_VALUES, AvailabilityStatus, EventOverride } from "../../domain/availability";

export class EventOverrideResponseDto implements EventOverride {
  @ApiProperty() eventId: string;
  @ApiProperty({ enum: AVAILABILITY_STATUS_VALUES }) status: AvailabilityStatus;
}
