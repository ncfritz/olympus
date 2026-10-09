import { DateTime } from "luxon";

/**
 * The home page's calendar widget: this week's meetings, five days or
 * seven. How it is set (days, collapsed, height) is kept in the browser,
 * as the home page's columns are.
 */

export const CALENDAR_WIDGET_KEY = "calendar.widget";

export type WeekDays = 5 | 7;

export interface CalendarWidgetSettings {
  /** The working week (Monday to Friday) or the whole week. */
  days: WeekDays;
  collapsed: boolean;
  /** The calendar's height, in pixels, as its bottom edge was dragged. */
  height: number;
}

export const MIN_HEIGHT = 240;
export const MAX_HEIGHT = 1600;

export const DEFAULT_CALENDAR_WIDGET: CalendarWidgetSettings = {
  days: 5,
  collapsed: false,
  height: 560,
};

/** A height the calendar can be: whole pixels, within its bounds. */
export const clampHeight = (height: number): number =>
  Math.round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height)));

/** Stored settings, each one that isn't valid replaced by its default. */
export const parseCalendarWidget = (value: unknown): CalendarWidgetSettings => {
  const stored = (value ?? {}) as Partial<Record<string, unknown>>;
  return {
    days:
      stored.days === 5 || stored.days === 7
        ? stored.days
        : DEFAULT_CALENDAR_WIDGET.days,
    collapsed:
      typeof stored.collapsed === "boolean"
        ? stored.collapsed
        : DEFAULT_CALENDAR_WIDGET.collapsed,
    height:
      typeof stored.height === "number" && Number.isFinite(stored.height)
        ? clampHeight(stored.height)
        : DEFAULT_CALENDAR_WIDGET.height,
  };
};

export interface WidgetWeek {
  /** Monday, at the start of the day. */
  start: DateTime;
  /** The day after the last one shown, at the start of the day. */
  end: DateTime;
  /** As the heading shows it: "Oct 5 – 9", or "Sep 28 – Oct 2". */
  label: string;
}

/** The week a day falls in (Monday first), five days or seven. */
export const weekOf = (day: DateTime, days: WeekDays): WidgetWeek => {
  const start = day.startOf("week");
  const end = start.plus({ days });
  const last = end.minus({ days: 1 });
  const label = last.hasSame(start, "month")
    ? `${start.toFormat("LLL d")} – ${last.toFormat("d")}`
    : `${start.toFormat("LLL d")} – ${last.toFormat("LLL d")}`;
  return { start, end, label };
};
