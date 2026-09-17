import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SYNCED_CALENDAR_STORE, SyncedCalendarStore } from "../store/synced-calendar-store";
import { SyncedCalendarConfig } from "./synced-calendar-config";

/**
 * The full list of synced calendars is two layers merged together:
 * - env-declared (SYNCED_CALENDARS) — infra config, read-only from the API.
 * - runtime-added (SyncedCalendarStore) — calendars added through the Sync
 *   page's discovery UI, which can also be removed through the API.
 */
@Injectable()
export class SyncConfigService {
  private readonly envCalendars: SyncedCalendarConfig[];

  constructor(
    config: ConfigService,
    @Inject(SYNCED_CALENDAR_STORE) private readonly store: SyncedCalendarStore,
  ) {
    const raw = config.get<string>("SYNCED_CALENDARS");
    this.envCalendars = raw ? parseCalendars(raw) : [];
  }

  async getAll(): Promise<SyncedCalendarConfig[]> {
    const dynamic = await this.store.listAll();
    return [...this.envCalendars, ...dynamic];
  }

  /** False for a calendar declared in SYNCED_CALENDARS — those can only be edited via the env var, not the API. */
  isRemovable(calendarId: string): boolean {
    return !this.envCalendars.some((c) => c.calendarId === calendarId);
  }

  /**
   * Adds a calendar discovered through the Sync page. The account must
   * already have at least one synced calendar (i.e. it's a known,
   * connected Google account) — bootstrapping a brand-new account isn't
   * supported from here yet.
   */
  async add(calendar: SyncedCalendarConfig): Promise<void> {
    const existing = await this.getAll();
    if (existing.some((c) => c.calendarId === calendar.calendarId)) {
      throw new ConflictException(`"${calendar.calendarId}" is already being synced`);
    }
    if (!existing.some((c) => c.accountLabel === calendar.accountLabel)) {
      throw new NotFoundException(`No configured calendar uses account "${calendar.accountLabel}" yet`);
    }
    await this.store.add(calendar);
  }

  /** Only a runtime-added calendar can be removed this way — an env-declared one requires editing SYNCED_CALENDARS. */
  async remove(calendarId: string): Promise<void> {
    const existing = await this.getAll();
    if (!existing.some((c) => c.calendarId === calendarId)) {
      throw new NotFoundException(`No configured calendar "${calendarId}"`);
    }
    if (!this.isRemovable(calendarId)) {
      throw new ForbiddenException(
        `"${calendarId}" is configured via the SYNCED_CALENDARS env var and can't be removed from here`,
      );
    }
    await this.store.remove(calendarId);
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
    const { provider, accountLabel, calendarId, source, enablePush } = entry as Partial<SyncedCalendarConfig>;
    if (provider !== "google" || !accountLabel || !calendarId || !source) {
      throw new Error(
        `SYNCED_CALENDARS[${index}] must have { provider: "google", accountLabel, calendarId, source }`,
      );
    }
    return { provider, accountLabel, calendarId, source, enablePush: enablePush === true };
  });
}
