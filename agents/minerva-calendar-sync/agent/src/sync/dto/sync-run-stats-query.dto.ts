import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { SyncRunFilterQueryDto } from "./sync-run-filter-query.dto";

export class SyncRunStatsQueryDto extends SyncRunFilterQueryDto {
  @ApiPropertyOptional({ description: "Trailing window size, in days", minimum: 1, maximum: 90, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number;
}
