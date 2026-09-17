import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString, Matches } from "class-validator";
import { FreeBusyQueryDto } from "./free-busy-query.dto";

const toBoolean = ({ value }: { value: unknown }) => value === "true" || value === true;
const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class StatusTimelineQueryDto extends FreeBusyQueryDto {
  @ApiPropertyOptional({
    description: "HH:mm, 24-hour, in `timezone` — start of the working-hours window",
    default: "08:00",
  })
  @IsOptional()
  @Matches(TIME_OF_DAY_PATTERN, { message: "dayStart must be HH:mm" })
  dayStart?: string;

  @ApiPropertyOptional({
    description: "HH:mm, 24-hour, in `timezone` — end of the working-hours window (exclusive)",
    default: "18:00",
  })
  @IsOptional()
  @Matches(TIME_OF_DAY_PATTERN, { message: "dayEnd must be HH:mm" })
  dayEnd?: string;

  @ApiPropertyOptional({
    description:
      'Compute Saturday/Sunday the same as weekdays instead of showing them as "none" except where an override applies',
    default: false,
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  treatWeekendsAsWorking?: boolean;

  @ApiPropertyOptional({
    description: 'IANA timezone name (e.g. "America/Los_Angeles") used to evaluate dayStart/dayEnd and weekday',
    default: "UTC",
  })
  @IsOptional()
  @IsString()
  timezone?: string;
}
