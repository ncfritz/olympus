import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SyncedCalendarStore } from "../../../src/store/synced-calendar-store";
import { SyncConfigService } from "../../../src/sync/sync-config.service";
import { SyncedCalendarConfig } from "../../../src/sync/synced-calendar-config";

const ENV_CALENDAR: SyncedCalendarConfig = {
  provider: "google",
  accountLabel: "work",
  calendarId: "primary",
  source: "Work",
  enablePush: false,
};

class FakeSyncedCalendarStore implements SyncedCalendarStore {
  calendars: SyncedCalendarConfig[] = [];

  async listAll(): Promise<SyncedCalendarConfig[]> {
    return this.calendars;
  }

  async add(calendar: SyncedCalendarConfig): Promise<void> {
    this.calendars.push(calendar);
  }

  async remove(calendarId: string): Promise<void> {
    this.calendars = this.calendars.filter((c) => c.calendarId !== calendarId);
  }
}

function makeService(envCalendars: SyncedCalendarConfig[], store = new FakeSyncedCalendarStore()) {
  const config = { get: () => JSON.stringify(envCalendars) } as unknown as ConfigService;
  return { service: new SyncConfigService(config, store), store };
}

describe("SyncConfigService", () => {
  it("returns an empty list when nothing is configured", async () => {
    const { service } = makeService([]);
    expect(await service.getAll()).toEqual([]);
  });

  it("merges env-declared and runtime-added calendars", async () => {
    const { service, store } = makeService([ENV_CALENDAR]);
    const added: SyncedCalendarConfig = {
      provider: "google",
      accountLabel: "work",
      calendarId: "secondary",
      source: "Secondary",
      enablePush: false,
    };
    await store.add(added);

    expect(await service.getAll()).toEqual([ENV_CALENDAR, added]);
  });

  describe("add", () => {
    it("adds a new calendar for an already-known account", async () => {
      const { service, store } = makeService([ENV_CALENDAR]);
      const added: SyncedCalendarConfig = {
        provider: "google",
        accountLabel: "work",
        calendarId: "secondary",
        source: "Secondary",
        enablePush: false,
      };

      await service.add(added);

      expect(store.calendars).toEqual([added]);
    });

    it("rejects a calendarId that's already synced", async () => {
      const { service } = makeService([ENV_CALENDAR]);

      await expect(service.add({ ...ENV_CALENDAR, source: "Duplicate" })).rejects.toThrow(ConflictException);
    });

    it("rejects an account that has no other synced calendar yet", async () => {
      const { service } = makeService([ENV_CALENDAR]);

      await expect(
        service.add({
          provider: "google",
          accountLabel: "never-connected",
          calendarId: "new-calendar",
          source: "New",
          enablePush: false,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("removes a runtime-added calendar", async () => {
      const { service, store } = makeService([ENV_CALENDAR]);
      const added: SyncedCalendarConfig = {
        provider: "google",
        accountLabel: "work",
        calendarId: "secondary",
        source: "Secondary",
        enablePush: false,
      };
      await store.add(added);

      await service.remove("secondary");

      expect(store.calendars).toEqual([]);
    });

    it("refuses to remove an env-declared calendar", async () => {
      const { service } = makeService([ENV_CALENDAR]);

      await expect(service.remove(ENV_CALENDAR.calendarId)).rejects.toThrow(ForbiddenException);
    });

    it("404s for a calendarId that isn't configured at all", async () => {
      const { service } = makeService([ENV_CALENDAR]);

      await expect(service.remove("unknown")).rejects.toThrow(NotFoundException);
    });
  });
});
