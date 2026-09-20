import { Inject, Injectable } from "@nestjs/common";
import type { CalendarColor } from "../../model/calendarColors";
import {
  CALENDAR_COLOR_STORE,
  type CalendarColorStore,
} from "../../store/calendarColorStore";

/**
 * Viewer-assigned display colors for calendar sources, keyed by source label
 * rather than calendar id — see CalendarColorStore for why (the "Overrides"
 * pseudo-source has no configured-calendar row to key off of).
 */
@Injectable()
export class CalendarColorService {
  constructor(
    @Inject(CALENDAR_COLOR_STORE) private readonly store: CalendarColorStore,
  ) {}

  list(): Promise<Record<string, string>> {
    return this.store.listColors();
  }

  async update(source: string, color: string): Promise<CalendarColor> {
    await this.store.setColor(source, color);
    return { source, color };
  }
}
