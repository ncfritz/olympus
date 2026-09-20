import { ConflictException, NotFoundException } from "@nestjs/common";
import { SyncedCalendarStore } from "../../../src/store/synced-calendar-store";
import { SyncConfigService } from "../../../src/sync/sync-config.service";
import { SyncedCalendarConfig } from "../../../src/sync/synced-calendar-config";

const CALENDAR: SyncedCalendarConfig = {
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

function makeService(seed: SyncedCalendarConfig[] = []) {
  const store = new FakeSyncedCalendarStore();
  store.calendars = [...seed];
  return { service: new SyncConfigService(store), store };
}

describe("SyncConfigService", () => {
  it("returns an empty list when nothing is configured", async () => {
    const { service } = makeService();
    expect(await service.getAll()).toEqual([]);
  });

  it("returns every stored calendar, google and microsoft alike", async () => {
    const msCalendar: SyncedCalendarConfig = {
      provider: "microsoft",
      accountLabel: "work-o365",
      calendarId: "primary",
      source: "Work O365",
      enablePush: false,
    };
    const { service } = makeService([CALENDAR, msCalendar]);

    expect(await service.getAll()).toEqual([CALENDAR, msCalendar]);
  });

  describe("add", () => {
    it("adds a new calendar", async () => {
      const { service, store } = makeService();
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
      const { service } = makeService([CALENDAR]);

      await expect(
        service.add({ ...CALENDAR, source: "Duplicate" }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("remove", () => {
    it("removes a stored calendar", async () => {
      const { service, store } = makeService([CALENDAR]);

      await service.remove(CALENDAR.calendarId);

      expect(store.calendars).toEqual([]);
    });

    it("404s for a calendarId that isn't configured at all", async () => {
      const { service } = makeService();

      await expect(service.remove("unknown")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
