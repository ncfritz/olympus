import { INestApplication } from "@nestjs/common";
import {
  SYNCED_CALENDAR_STORE,
  SyncedCalendarStore,
} from "../../src/store/synced-calendar-store";
import { SyncedCalendarConfig } from "../../src/sync/synced-calendar-config";

/**
 * Seeds a calendar directly into the DB-backed store, bypassing the API —
 * what a real "connect account, add calendar" flow persists, without
 * needing a stored OAuth credential just to get a fixture in place.
 */
export async function seedCalendar(
  app: INestApplication,
  calendar: SyncedCalendarConfig,
): Promise<void> {
  const store = app.get<SyncedCalendarStore>(SYNCED_CALENDAR_STORE);
  await store.add(calendar);
}
