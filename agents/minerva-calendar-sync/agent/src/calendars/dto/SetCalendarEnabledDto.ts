import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class SetCalendarEnabledDto {
  @ApiProperty({ description: "Whether this calendar's sync should run" })
  @IsBoolean()
  enabled: boolean;
}
