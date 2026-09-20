import { ApiProperty, PickType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Matches, ValidateNested } from "class-validator";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** A display color the viewer chose for a calendar source (or the "Overrides" pseudo-source). */
export class CalendarColor {
  @ApiProperty({
    type: String,
    required: true,
    description: "The source label the color belongs to",
  })
  source: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The color, as a 6-digit hex string such as #1677ff",
    example: "#1677ff",
  })
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: "color must be a 6-digit hex color, e.g. #1677ff",
  })
  color: string;
}

export class PartialCalendarColor extends PickType(CalendarColor, ["color"]) {}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class UpdateCalendarColorRequest {
  @ApiProperty({
    type: () => PartialCalendarColor,
    required: true,
    description: "The color to set.",
  })
  @ValidateNested()
  @Type(() => PartialCalendarColor)
  calendarColor: PartialCalendarColor;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListCalendarColorsResponse {
  @ApiProperty({
    type: Object,
    additionalProperties: { type: "string" },
    required: true,
    description: "Every stored color, keyed by source label",
    example: { "personal-gmail": "#1677ff", Overrides: "#f5222d" },
  })
  calendarColors: Record<string, string>;
}

export class UpdateCalendarColorResponse {
  @ApiProperty({
    type: () => CalendarColor,
    required: true,
    description: "The color as stored.",
  })
  calendarColor: CalendarColor;
}
