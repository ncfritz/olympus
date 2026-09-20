import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsIn, IsISO8601, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { OCCURRENCE_TYPE_VALUES, OccurrenceType } from "../../domain/canonical-event";

const toBoolean = ({ value }: { value: unknown }) => value === "true" || value === true;

export class ListEventsQueryDto {
  @ApiPropertyOptional({ description: "Filter to events from this configured calendar's source label" })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ description: "ISO-8601 — only events starting at or after this instant" })
  @IsOptional()
  @IsISO8601()
  startsAfter?: string;

  @ApiPropertyOptional({ description: "ISO-8601 — only events starting at or before this instant" })
  @IsOptional()
  @IsISO8601()
  startsBefore?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  cancelled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  deleted?: boolean;

  @ApiPropertyOptional({ enum: OCCURRENCE_TYPE_VALUES })
  @IsOptional()
  @IsIn(OCCURRENCE_TYPE_VALUES)
  occurrenceType?: OccurrenceType;

  @ApiPropertyOptional({ minimum: 1, maximum: 1000, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;

  @ApiPropertyOptional({ description: "Internal event id to page from (exclusive)" })
  @IsOptional()
  @IsString()
  cursor?: string;
}
