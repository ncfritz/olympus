import { ApiProperty } from "@nestjs/swagger";
import { Matches } from "class-validator";

export class SetCalendarColorDto {
  @ApiProperty({ description: "Hex color, e.g. #1677ff", example: "#1677ff" })
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: "color must be a 6-digit hex color, e.g. #1677ff",
  })
  color: string;
}
