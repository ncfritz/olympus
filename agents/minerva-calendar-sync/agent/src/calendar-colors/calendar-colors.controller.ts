import { Body, Controller, Get, HttpCode, Inject, Param, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { CALENDAR_COLOR_STORE, CalendarColorStore } from "../store/calendar-color-store";
import { SetCalendarColorDto } from "./dto/set-calendar-color.dto";

/**
 * Viewer-assigned display colors for calendar sources, keyed by source label
 * rather than calendar id — see CalendarColorStore for why (the "Overrides"
 * pseudo-source has no configured-calendar row to key off of).
 */
@ApiBearerAuth()
@ApiTags("calendar-colors")
@Controller("calendar-colors")
export class CalendarColorsController {
  constructor(
    @Inject(CALENDAR_COLOR_STORE) private readonly store: CalendarColorStore,
  ) {}

  @Get()
  @ApiOkResponse({
    description: "All stored colors, keyed by source label",
    schema: {
      type: "object",
      additionalProperties: { type: "string" },
      example: { "personal-gmail": "#1677ff", Overrides: "#f5222d" },
    },
  })
  list(): Promise<Record<string, string>> {
    return this.store.listColors();
  }

  @Put(":source")
  @HttpCode(204)
  @ApiNoContentResponse()
  async setColor(
    @Param("source") source: string,
    @Body() body: SetCalendarColorDto,
  ): Promise<void> {
    await this.store.setColor(source, body.color);
  }
}
