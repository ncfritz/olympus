const STORAGE_KEY = "minerva:calendarColors";

/** A generic categorical palette (AntD-ish hues), not tied to any particular status meaning. */
const PALETTE = [
  "#1677ff",
  "#52c41a",
  "#fa8c16",
  "#eb2f96",
  "#722ed1",
  "#13c2c2",
  "#a0d911",
  "#f5222d",
  "#2f54eb",
  "#fa541c",
];

/** Deterministic so a calendar gets a stable default color before the user ever picks one, and the same one again if their customization is ever lost. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function defaultColorFor(source: string): string {
  return PALETTE[hashString(source) % PALETTE.length];
}

/** Per-viewer preference only — there's no backend concept of a calendar's color, so this lives in localStorage. */
export function loadCalendarColors(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function saveCalendarColors(colors: Record<string, string>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  } catch {
    // Best-effort — a private window or blocked storage just means the customization doesn't survive a reload.
  }
}
