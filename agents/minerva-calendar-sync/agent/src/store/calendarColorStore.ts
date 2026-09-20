/**
 * Viewer-assigned display colors for calendar sources, keyed by the source
 * label rather than a foreign key — sources include the "Overrides"
 * pseudo-calendar, which has no row in any configured-calendar table.
 */
export interface CalendarColorStore {
  listColors(): Promise<Record<string, string>>;
  setColor(source: string, color: string): Promise<void>;
}

/** Nest DI token — inject with `@Inject(CALENDAR_COLOR_STORE)`. */
export const CALENDAR_COLOR_STORE = Symbol("CALENDAR_COLOR_STORE");
