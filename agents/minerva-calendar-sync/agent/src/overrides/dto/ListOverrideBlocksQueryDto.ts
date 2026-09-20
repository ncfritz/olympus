import { ApiProperty } from "@nestjs/swagger";
import { IsISO8601 } from "class-validator";

export class ListOverrideBlocksQueryDto {
  @ApiProperty({
    description: "ISO-8601 — inclusive start of the range to list",
  })
  @IsISO8601()
  start: string;

  @ApiProperty({ description: "ISO-8601 — exclusive end of the range to list" })
  @IsISO8601()
  end: string;
}
