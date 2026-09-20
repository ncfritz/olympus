import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { SyncRunFilterQueryDto } from "./sync-run-filter-query.dto";

export class ListSyncRunsQueryDto extends SyncRunFilterQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ description: "Sync run id to page from (exclusive)" })
  @IsOptional()
  @IsString()
  cursor?: string;
}
