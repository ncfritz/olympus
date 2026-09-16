import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class ListEventOverridesQueryDto {
  @ApiProperty({ description: "Comma-separated canonical event ids to look up overrides for" })
  @IsString()
  ids: string;
}
