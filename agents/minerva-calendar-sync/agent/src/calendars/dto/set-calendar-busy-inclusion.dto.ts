import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class SetCalendarBusyInclusionDto {
  @ApiProperty({ description: "Whether this calendar's events should count toward the busy/free calculation" })
  @IsBoolean()
  includedInBusy: boolean;
}
