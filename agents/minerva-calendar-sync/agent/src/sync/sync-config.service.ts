import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { SYNCED_CALENDAR_STORE, SyncedCalendarStore } from "../store/synced-calendar-store";
import { SyncedCalendarConfig } from "./synced-calendar-config";

/**
 * The list of calendars this instance keeps synchronized — entirely
 * DB-backed (see SyncedCalendarStore), so adding, enabling, or removing one
 * is an ordinary API call that takes effect immediately, no env file edit or
 * server restart involved.
 */
@Injectable()
export class SyncConfigService {
  constructor(@Inject(SYNCED_CALENDAR_STORE) private readonly store: SyncedCalendarStore) {}

  async getAll(): Promise<SyncedCalendarConfig[]> {
    return this.store.listAll();
  }

  /**
   * Adds a calendar discovered through the Sync page. CalendarsController
   * checks the account is actually connected (CalendarAuthService.isConnected)
   * before calling this — this layer only guards against double-adding the
   * same calendar.
   */
  async add(calendar: SyncedCalendarConfig): Promise<void> {
    const existing = await this.getAll();
    if (existing.some((c) => c.calendarId === calendar.calendarId)) {
      throw new ConflictException(`"${calendar.calendarId}" is already being synced`);
    }
    await this.store.add(calendar);
  }

  async remove(calendarId: string): Promise<void> {
    const existing = await this.getAll();
    if (!existing.some((c) => c.calendarId === calendarId)) {
      throw new NotFoundException(`No configured calendar "${calendarId}"`);
    }
    await this.store.remove(calendarId);
  }
}
