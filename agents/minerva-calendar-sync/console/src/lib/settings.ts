const STORAGE_KEY = "minerva:timelineSettings";

/** Day-start/day-end window, weekend handling, and timezone for the calendar's status timeline strip — persisted per-viewer, mirrors /freebusy/timeline's own query params. */
export interface TimelineSettings {
  /** HH:mm, 24-hour, in `timezone`. */
  dayStart: string;
  /** HH:mm, 24-hour, in `timezone` — exclusive. */
  dayEnd: string;
  treatWeekendsAsWorking: boolean;
  /** IANA name (e.g. "America/Los_Angeles"). */
  timezone: string;
}

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function defaultTimelineSettings(): TimelineSettings {
  return {
    dayStart: "08:00",
    dayEnd: "18:00",
    treatWeekendsAsWorking: false,
    timezone: detectTimezone(),
  };
}

export function loadTimelineSettings(): TimelineSettings {
  const defaults = defaultTimelineSettings();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...(JSON.parse(raw) as Partial<TimelineSettings>) };
  } catch {
    return defaults;
  }
}

export function saveTimelineSettings(settings: TimelineSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Best-effort — a private window or blocked storage just means the customization doesn't survive a reload.
  }
}
