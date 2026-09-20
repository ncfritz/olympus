import { SchedulerRegistry } from "@nestjs/schedule";
import { execSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  CalendarProvider,
  IncrementalResult,
  ProviderCalendar,
  PushChannel,
  RawEventBatch,
  RemovalTombstone,
} from "../../../../src/providers/calendarProvider";
import { CalendarProviderRegistry } from "../../../../src/providers/services/CalendarProviderRegistry";
import { PrismaEventStore } from "../../../../src/store/prisma/PrismaEventStore";
import { PrismaService } from "../../../../src/store/prisma/PrismaService";
import type { SyncConfigType } from "../../../../src/config/configuration";
import { SyncConfigService } from "../../../../src/sync/services/SyncConfigService";
import { SyncedCalendarConfig } from "../../../../src/sync/syncedCalendarConfig";
import { WebhookNotifier } from "../../../../src/sync/services/WebhookNotifier";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const API_ROOT = join(__dirname, "..", "..", "..", "..");

const PUSH_CALENDAR: SyncedCalendarConfig = {
  provider: "google",
  accountLabel: "test-account",
  calendarId: "cal-1",
  source: "test-source",
  enablePush: true,
};

class FakeCalendarProvider implements CalendarProvider {
  readonly id = "fake";
  watchCallCount = 0;
  stopWatchCallCount = 0;
  nextChannel: PushChannel = {
    id: "chan-1",
    resourceId: "res-1",
    expiration: "2099-01-01T00:00:00.000Z",
  };

  async listCalendars(): Promise<ProviderCalendar[]> {
    return [];
  }
  async *fullSync(): AsyncIterable<RawEventBatch> {}
  async incrementalSync(): Promise<IncrementalResult> {
    return { events: [], nextSyncToken: "token" };
  }
  normalizeEvent(): never {
    throw new Error("not used in these tests");
  }
  isRemoval(): boolean {
    return false;
  }
  resolveRemoval(): RemovalTombstone {
    throw new Error("not used in these tests");
  }
  supportsPush(): boolean {
    return true;
  }
  async watch(): Promise<PushChannel> {
    this.watchCallCount += 1;
    return this.nextChannel;
  }
  async stopWatch(): Promise<void> {
    this.stopWatchCallCount += 1;
  }
}

function fakeConfig(webhookBaseUrl: string | undefined): SyncConfigType {
  return { webhookBaseUrl } as SyncConfigType;
}

function fakeSyncConfig(calendars: SyncedCalendarConfig[]): SyncConfigService {
  return { getAll: async () => calendars } as unknown as SyncConfigService;
}

describe("WebhookNotifier", () => {
  let tempDir: string;
  let prisma: PrismaService;
  let store: PrismaEventStore;
  let provider: FakeCalendarProvider;
  let scheduler: SchedulerRegistry;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), "minerva-test-"));
    process.env.DATABASE_URL = `file:${join(tempDir, "test.db")}`;
    execSync("npx prisma db push --skip-generate", {
      cwd: API_ROOT,
      env: process.env,
      stdio: "pipe",
    });
  }, 30000);

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    await prisma.event.deleteMany();
    await prisma.syncState.deleteMany();
    store = new PrismaEventStore(prisma);
    provider = new FakeCalendarProvider();
    scheduler = new SchedulerRegistry();
  });

  afterEach(async () => {
    scheduler.getIntervals().forEach((name) => scheduler.deleteInterval(name));
    await prisma.onModuleDestroy();
  });

  function buildNotifier(
    calendars: SyncedCalendarConfig[],
    webhookBaseUrl: string | undefined,
  ): WebhookNotifier {
    const registry = {
      resolve: () => provider,
    } as unknown as CalendarProviderRegistry;
    return new WebhookNotifier(
      fakeSyncConfig(calendars),
      registry,
      store,
      scheduler,
      fakeConfig(webhookBaseUrl),
    );
  }

  it("does nothing when no calendar has enablePush", async () => {
    const notifier = buildNotifier(
      [{ ...PUSH_CALENDAR, enablePush: false }],
      "https://example.com",
    );
    notifier.start(vi.fn());
    await notifier.waitUntilReady();

    expect(provider.watchCallCount).toBe(0);
  });

  it("warns and stays poll-only when WEBHOOK_BASE_URL is missing", async () => {
    const notifier = buildNotifier([PUSH_CALENDAR], undefined);
    notifier.start(vi.fn());
    await notifier.waitUntilReady();

    expect(provider.watchCallCount).toBe(0);
  });

  it("warns and stays poll-only when WEBHOOK_BASE_URL is not HTTPS", async () => {
    const notifier = buildNotifier([PUSH_CALENDAR], "http://example.com");
    notifier.start(vi.fn());
    await notifier.waitUntilReady();

    expect(provider.watchCallCount).toBe(0);
  });

  it("registers a push channel and persists it to sync state", async () => {
    const notifier = buildNotifier([PUSH_CALENDAR], "https://example.com");
    notifier.start(vi.fn());
    await notifier.waitUntilReady();

    expect(provider.watchCallCount).toBe(1);
    const state = await store.getSyncState(PUSH_CALENDAR.calendarId);
    expect(state?.channelId).toBe("chan-1");
    expect(state?.resourceId).toBe("res-1");
    expect(state?.channelExpiration).toBe("2099-01-01T00:00:00.000Z");
    expect(state?.channelToken).toEqual(expect.any(String));
  });

  it("preserves an existing sync token when registering a channel", async () => {
    await store.saveSyncState(PUSH_CALENDAR.calendarId, {
      calendarId: PUSH_CALENDAR.calendarId,
      syncToken: "existing-token",
      channelId: null,
      resourceId: null,
      channelExpiration: null,
      channelToken: null,
      lastFullSyncAt: null,
    });

    const notifier = buildNotifier([PUSH_CALENDAR], "https://example.com");
    notifier.start(vi.fn());
    await notifier.waitUntilReady();

    expect(
      (await store.getSyncState(PUSH_CALENDAR.calendarId))?.syncToken,
    ).toBe("existing-token");
  });

  it("calls onChange for a notification with the matching channel and token", async () => {
    const onChange = vi.fn();
    const notifier = buildNotifier([PUSH_CALENDAR], "https://example.com");
    notifier.start(onChange);
    await notifier.waitUntilReady();

    const state = await store.getSyncState(PUSH_CALENDAR.calendarId);
    notifier.handleNotification("chan-1", state!.channelToken!);

    expect(onChange).toHaveBeenCalledWith(PUSH_CALENDAR.calendarId, "webhook");
  });

  it("ignores a notification with the wrong token", async () => {
    const onChange = vi.fn();
    const notifier = buildNotifier([PUSH_CALENDAR], "https://example.com");
    notifier.start(onChange);
    await notifier.waitUntilReady();

    notifier.handleNotification("chan-1", "wrong-token");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("ignores a notification for an unknown channel", async () => {
    const onChange = vi.fn();
    const notifier = buildNotifier([PUSH_CALENDAR], "https://example.com");
    notifier.start(onChange);
    await notifier.waitUntilReady();

    notifier.handleNotification("unknown-channel", "anything");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("renews a channel expiring soon and stops the old one", async () => {
    provider.nextChannel = {
      id: "chan-1",
      resourceId: "res-1",
      expiration: expiringSoon(),
    };
    const notifier = buildNotifier([PUSH_CALENDAR], "https://example.com");
    notifier.start(vi.fn());
    await notifier.waitUntilReady();

    provider.nextChannel = {
      id: "chan-2",
      resourceId: "res-2",
      expiration: "2099-01-01T00:00:00.000Z",
    };
    await (
      notifier as unknown as {
        renewExpiringChannels: (c: SyncedCalendarConfig[]) => Promise<void>;
      }
    ).renewExpiringChannels([PUSH_CALENDAR]);

    expect(provider.watchCallCount).toBe(2);
    expect(provider.stopWatchCallCount).toBe(1);

    const state = await store.getSyncState(PUSH_CALENDAR.calendarId);
    expect(state?.channelId).toBe("chan-2");

    const onChange = vi.fn();
    (
      notifier as unknown as { onChange: (id: string, trigger: string) => void }
    ).onChange = onChange;
    notifier.handleNotification("chan-1", "anything");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not renew a channel that isn't close to expiring", async () => {
    const notifier = buildNotifier([PUSH_CALENDAR], "https://example.com");
    notifier.start(vi.fn());
    await notifier.waitUntilReady();

    await (
      notifier as unknown as {
        renewExpiringChannels: (c: SyncedCalendarConfig[]) => Promise<void>;
      }
    ).renewExpiringChannels([PUSH_CALENDAR]);

    expect(provider.watchCallCount).toBe(1);
    expect(provider.stopWatchCallCount).toBe(0);
  });
});

function expiringSoon(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now
}
