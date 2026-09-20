import { SchedulerRegistry } from "@nestjs/schedule";
import { PollingNotifier } from "../../../src/sync/polling-notifier";
import { SyncConfigService } from "../../../src/sync/sync-config.service";
import { SyncedCalendarConfig } from "../../../src/sync/synced-calendar-config";
import { afterEach, describe, expect, it, vi } from "vitest";

function fakeSyncConfig(
  getCalendars: () => SyncedCalendarConfig[],
): SyncConfigService {
  return { getAll: async () => getCalendars() } as unknown as SyncConfigService;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("PollingNotifier", () => {
  const originalPollInterval = process.env.POLL_INTERVAL_MS;
  let scheduler: SchedulerRegistry;
  let notifier: PollingNotifier | undefined;

  afterEach(() => {
    notifier?.stop();
    notifier = undefined;
    process.env.POLL_INTERVAL_MS = originalPollInterval;
  });

  it("fires once immediately for every currently configured calendar", async () => {
    scheduler = new SchedulerRegistry();
    notifier = new PollingNotifier(
      fakeSyncConfig(() => [
        {
          provider: "google",
          accountLabel: "a",
          calendarId: "cal-1",
          source: "A",
          enablePush: false,
        },
        {
          provider: "google",
          accountLabel: "a",
          calendarId: "cal-2",
          source: "A2",
          enablePush: false,
        },
      ]),
      scheduler,
    );
    const onChange = vi.fn();

    notifier.start(onChange);
    await delay(5);

    expect(onChange).toHaveBeenCalledWith("cal-1", "poll");
    expect(onChange).toHaveBeenCalledWith("cal-2", "poll");
  });

  it("picks up a calendar added after start(), on the next tick, with no restart", async () => {
    process.env.POLL_INTERVAL_MS = "20";
    let calendars: SyncedCalendarConfig[] = [];
    scheduler = new SchedulerRegistry();
    notifier = new PollingNotifier(
      fakeSyncConfig(() => calendars),
      scheduler,
    );
    const onChange = vi.fn();

    notifier.start(onChange);
    await delay(5);
    expect(onChange).not.toHaveBeenCalled();

    calendars = [
      {
        provider: "google",
        accountLabel: "a",
        calendarId: "cal-new",
        source: "A",
        enablePush: false,
      },
    ];
    await delay(40);

    expect(onChange).toHaveBeenCalledWith("cal-new", "poll");
  });

  it("stops ticking once stop() is called", async () => {
    process.env.POLL_INTERVAL_MS = "20";
    scheduler = new SchedulerRegistry();
    notifier = new PollingNotifier(
      fakeSyncConfig(() => [
        {
          provider: "google",
          accountLabel: "a",
          calendarId: "cal-1",
          source: "A",
          enablePush: false,
        },
      ]),
      scheduler,
    );
    const onChange = vi.fn();

    notifier.start(onChange);
    await delay(5);
    notifier.stop();
    onChange.mockClear();

    await delay(60);

    expect(onChange).not.toHaveBeenCalled();
  });
});
