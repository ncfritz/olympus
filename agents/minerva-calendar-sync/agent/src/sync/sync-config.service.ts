import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SyncedCalendarConfig } from "./synced-calendar-config";

/** Reads the declarative list of synced calendars from the SYNCED_CALENDARS env var (JSON array). */
@Injectable()
export class SyncConfigService {
  private readonly calendars: SyncedCalendarConfig[];

  constructor(config: ConfigService) {
    const raw = config.get<string>("SYNCED_CALENDARS");
    this.calendars = raw ? parseCalendars(raw) : [];
  }

  getAll(): SyncedCalendarConfig[] {
    return this.calendars;
  }
}

function parseCalendars(raw: string): SyncedCalendarConfig[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`SYNCED_CALENDARS is not valid JSON: ${(error as Error).message}`, { cause: error });
  }

  if (!Array.isArray(parsed)) {
    throw new Error("SYNCED_CALENDARS must be a JSON array");
  }

  return parsed.map((entry, index) => {
    const { provider, accountLabel, calendarId, source } = entry as Partial<SyncedCalendarConfig>;
    if (provider !== "google" || !accountLabel || !calendarId || !source) {
      throw new Error(
        `SYNCED_CALENDARS[${index}] must have { provider: "google", accountLabel, calendarId, source }`,
      );
    }
    return { provider, accountLabel, calendarId, source };
  });
}
