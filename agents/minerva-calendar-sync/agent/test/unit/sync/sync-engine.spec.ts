import { execSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { ConfigService } from "@nestjs/config";

import { CanonicalCalendarEvent } from "../../../src/domain/canonical-event";
import {
  NewSyncRun,
  SyncRun,
  SyncRunDailyStat,
  SyncRunFilter,
  SyncRunStatsFilter,
  SyncRunWithChanges,
} from "../../../src/domain/sync-run";
import {
  CalendarProvider,
  IncrementalResult,
  ProviderCalendar,
  RawEventBatch,
  RemovalTombstone,
  SyncTokenExpiredError,
  SyncWindow,
} from "../../../src/providers/calendar-provider";
import { CalendarProviderRegistry } from "../../../src/providers/calendar-provider-registry";
import { CalendarEnablementStore } from "../../../src/store/calendar-enablement-store";
import { PrismaEventStore } from "../../../src/store/prisma/prisma-event-store";
import { PrismaService } from "../../../src/store/prisma/prisma.service";
import { SyncRunStore } from "../../../src/store/sync-run-store";
import { SyncEngine } from "../../../src/sync/sync-engine";
import { SyncedCalendarConfig } from "../../../src/sync/synced-calendar-config";

const API_ROOT = join(__dirname, "..", "..", "..");

const CONFIG: SyncedCalendarConfig = {
  provider: "google",
  accountLabel: "test-account",
  calendarId: "cal-1",
  source: "test-source",
  enablePush: false,
};

// Relative to "now" (not a fixed date, unlike most other fixtureEvent
// look-alikes in this test suite) — SyncEngine's window-bounded full sync
// (see computeSyncWindow) filters markVanishedEventsDeleted's candidates by
// startTime, so a fixed past date would eventually drift outside that
// window and silently stop being a valid "in range" fixture.
const FIXTURE_START = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const FIXTURE_END = new Date(Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString();

function fixtureEvent(overrides: Partial<CanonicalCalendarEvent> = {}): CanonicalCalendarEvent {
  const uid = overrides.uid ?? "uid-1";
  return {
    id: `${CONFIG.source}:${uid}`,
    subject: "Test event",
    sensitivity: "normal",
    importance: "normal",
    occurrenceType: "single",
    type: "appointment",
    reminder: false,
    response: "accepted",
    startTime: FIXTURE_START,
    endTime: FIXTURE_END,
    duration: 30,
    allDay: false,
    status: "busy",
    location: null,
    cancelled: false,
    organizerEmail: null,
    deleted: false,
    uid,
    recurrenceId: null,
    recurrenceRule: null,
    source: CONFIG.source,
    ...overrides,
  };
}

/** A fully scriptable CalendarProvider stand-in — no network, no real Google types. */
class FakeCalendarProvider implements CalendarProvider {
  readonly id = "fake";
  fullSyncBatches: RawEventBatch[] = [];
  fullSyncGate: Promise<void> = Promise.resolve();
  fullSyncCallCount = 0;
  lastFullSyncWindow: SyncWindow | null = null;
  incrementalQueue: (IncrementalResult | Error)[] = [];

  async listCalendars(): Promise<ProviderCalendar[]> {
    return [];
  }

  async *fullSync(_calendarId: string, window: SyncWindow): AsyncIterable<RawEventBatch> {
    this.fullSyncCallCount += 1;
    this.lastFullSyncWindow = window;
    await this.fullSyncGate;
    for (const batch of this.fullSyncBatches) yield batch;
  }

  async incrementalSync(): Promise<IncrementalResult> {
    const next = this.incrementalQueue.shift();
    if (!next) throw new Error("FakeCalendarProvider.incrementalSync called with an empty queue");
    if (next instanceof Error) throw next;
    return next;
  }

  async normalizeEvent(raw: unknown, ctx: { source: string; calendarId: string }): Promise<CanonicalCalendarEvent> {
    const marker = raw as { __fail?: boolean };
    if (marker.__fail) throw new Error("normalize failed (test fixture)");
    return { ...(raw as CanonicalCalendarEvent), source: ctx.source };
  }

  isRemoval(raw: unknown): boolean {
    return (raw as { __removal?: RemovalTombstone }).__removal !== undefined;
  }

  resolveRemoval(raw: unknown): RemovalTombstone {
    return (raw as { __removal: RemovalTombstone }).__removal;
  }

  supportsPush(): boolean {
    return false;
  }
}

function removalRaw(tombstone: RemovalTombstone): unknown {
  return { __removal: tombstone };
}

/** In-memory stand-in — a mutable map the test can flip mid-run rather than a real store. */
class FakeEnablementStore implements CalendarEnablementStore {
  overrides: Record<string, boolean> = {};

  async listOverrides(): Promise<Record<string, boolean>> {
    return this.overrides;
  }

  async setEnabled(calendarId: string, enabled: boolean): Promise<void> {
    this.overrides[calendarId] = enabled;
  }
}

/** In-memory stand-in — records every run SyncEngine persisted, in order, for the test to assert on. */
class FakeSyncRunStore implements SyncRunStore {
  runs: SyncRun[] = [];
  private nextId = 1;

  async create(run: NewSyncRun): Promise<SyncRun> {
    const saved: SyncRun = { ...run, id: `run-${this.nextId++}` };
    this.runs.push(saved);
    return saved;
  }

  async list(_filter: SyncRunFilter): Promise<SyncRun[]> {
    return this.runs;
  }

  async get(_id: string): Promise<SyncRunWithChanges | null> {
    throw new Error("not implemented in FakeSyncRunStore");
  }

  async dailyStats(_filter: SyncRunStatsFilter): Promise<SyncRunDailyStat[]> {
    throw new Error("not implemented in FakeSyncRunStore");
  }

  async pruneFinishedBefore(_cutoff: Date): Promise<number> {
    return 0;
  }
}

describe("SyncEngine", () => {
  let tempDir: string;
  let prisma: PrismaService;
  let store: PrismaEventStore;
  let provider: FakeCalendarProvider;
  let enablement: FakeEnablementStore;
  let syncRuns: FakeSyncRunStore;
  let engine: SyncEngine;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), "minerva-test-"));
    process.env.DATABASE_URL = `file:${join(tempDir, "test.db")}`;
    execSync("npx prisma db push --skip-generate", { cwd: API_ROOT, env: process.env, stdio: "pipe" });
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
    enablement = new FakeEnablementStore();
    syncRuns = new FakeSyncRunStore();
    const registry = { resolve: () => provider } as unknown as CalendarProviderRegistry;
    engine = new SyncEngine(store, enablement, registry, syncRuns, new ConfigService());
  });

  afterEach(async () => {
    await prisma.onModuleDestroy();
  });

  it("runs a full sync when there is no stored sync token, and saves the token", async () => {
    provider.fullSyncBatches = [
      { events: [fixtureEvent({ uid: "a" }), fixtureEvent({ uid: "b" })], nextSyncToken: "token-1" },
    ];

    await engine.syncOne(CONFIG, "manual");

    const events = await store.listEvents({ source: CONFIG.source });
    expect(events.map((e) => e.uid).sort()).toEqual(["a", "b"]);
    const state = await store.getSyncState(CONFIG.calendarId);
    expect(state?.syncToken).toBe("token-1");
    expect(state?.lastFullSyncAt).toEqual(expect.any(String));
  });

  it("bounds the full sync to a window around the default past/future days", async () => {
    provider.fullSyncBatches = [{ events: [fixtureEvent({ uid: "a" })], nextSyncToken: "token-1" }];
    const before = Date.now();

    await engine.syncOne(CONFIG, "manual");

    const window = provider.lastFullSyncWindow;
    expect(window).not.toBeNull();
    // Defaults: 30 days back, 180 days forward (see SyncEngine's
    // DEFAULT_SYNC_WINDOW_*_DAYS) — checked loosely against wall-clock time
    // taken just before the sync ran, rather than asserting exact instants.
    expect(Date.parse(window!.start)).toBeLessThan(before - 29 * 24 * 60 * 60 * 1000);
    expect(Date.parse(window!.start)).toBeGreaterThan(before - 31 * 24 * 60 * 60 * 1000);
    expect(Date.parse(window!.end)).toBeGreaterThan(before + 179 * 24 * 60 * 60 * 1000);
    expect(Date.parse(window!.end)).toBeLessThan(before + 181 * 24 * 60 * 60 * 1000);
  });

  it("forces a fresh full sync once the window is stale, even with a valid sync token", async () => {
    await store.saveSyncState(CONFIG.calendarId, {
      calendarId: CONFIG.calendarId,
      syncToken: "token-1",
      channelId: null,
      resourceId: null,
      channelExpiration: null,
      channelToken: null,
      // Well past WINDOW_REFRESH_INTERVAL_MS (24h) — a valid syncToken alone
      // shouldn't be enough to take the incremental path once this is stale.
      lastFullSyncAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    });
    provider.fullSyncBatches = [{ events: [fixtureEvent({ uid: "a" })], nextSyncToken: "token-2" }];
    provider.incrementalQueue = [{ events: [], nextSyncToken: "should-not-be-used" }];

    await engine.syncOne(CONFIG, "manual");

    expect(provider.fullSyncCallCount).toBe(1);
    expect(provider.incrementalQueue).toHaveLength(1); // untouched
    expect((await store.getSyncState(CONFIG.calendarId))?.syncToken).toBe("token-2");
  });

  it("skips an event that fails to normalize without aborting the rest of the sync", async () => {
    provider.fullSyncBatches = [
      { events: [{ __fail: true }, fixtureEvent({ uid: "good" })], nextSyncToken: "token-1" },
    ];

    await engine.syncOne(CONFIG, "manual");

    const events = await store.listEvents({ source: CONFIG.source });
    expect(events.map((e) => e.uid)).toEqual(["good"]);
    expect((await store.getSyncState(CONFIG.calendarId))?.syncToken).toBe("token-1");
  });

  it("marks events that vanished from a full resync as deleted", async () => {
    await store.upsertEvent(fixtureEvent({ uid: "stale" }));
    provider.fullSyncBatches = [{ events: [fixtureEvent({ uid: "fresh" })], nextSyncToken: "token-1" }];

    await engine.syncOne(CONFIG, "manual");

    expect((await store.getEvent(CONFIG.source, "stale"))?.deleted).toBe(true);
    expect((await store.getEvent(CONFIG.source, "fresh"))?.deleted).toBe(false);
  });

  it("leaves a stored event outside the sync window alone, rather than treating it as vanished", async () => {
    // Far outside the default 30-day-past/180-day-future window — a full
    // sync bounded to that window was never going to see this event either
    // way, so its absence from fullSyncBatches shouldn't be read as "gone".
    const longAgo = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    await store.upsertEvent(fixtureEvent({ uid: "ancient", startTime: longAgo, endTime: longAgo }));
    provider.fullSyncBatches = [{ events: [fixtureEvent({ uid: "fresh" })], nextSyncToken: "token-1" }];

    await engine.syncOne(CONFIG, "manual");

    expect((await store.getEvent(CONFIG.source, "ancient"))?.deleted).toBe(false);
    expect((await store.getEvent(CONFIG.source, "fresh"))?.deleted).toBe(false);
  });

  it("applies an incremental update to an existing event and advances the sync token", async () => {
    await store.upsertEvent(fixtureEvent({ uid: "a", subject: "Original" }));
    await store.saveSyncState(CONFIG.calendarId, {
      calendarId: CONFIG.calendarId,
      syncToken: "token-1",
      channelId: null,
      resourceId: null,
      channelExpiration: null,
      channelToken: null,
      lastFullSyncAt: new Date().toISOString(),
    });
    provider.incrementalQueue = [
      { events: [fixtureEvent({ uid: "a", subject: "Updated" })], nextSyncToken: "token-2" },
    ];

    await engine.syncOne(CONFIG, "manual");

    expect((await store.getEvent(CONFIG.source, "a"))?.subject).toBe("Updated");
    expect((await store.getSyncState(CONFIG.calendarId))?.syncToken).toBe("token-2");
  });

  it("soft-cancels a removed occurrence of a recurring series, without deleting it", async () => {
    await store.upsertEvent(fixtureEvent({ uid: "occ-1", recurrenceId: "series-1" }));
    await store.saveSyncState(CONFIG.calendarId, {
      calendarId: CONFIG.calendarId,
      syncToken: "token-1",
      channelId: null,
      resourceId: null,
      channelExpiration: null,
      channelToken: null,
      lastFullSyncAt: new Date().toISOString(),
    });
    provider.incrementalQueue = [
      { events: [removalRaw({ uid: "occ-1", isOccurrence: true })], nextSyncToken: "token-2" },
    ];

    await engine.syncOne(CONFIG, "manual");

    const event = await store.getEvent(CONFIG.source, "occ-1");
    expect(event?.cancelled).toBe(true);
    expect(event?.deleted).toBe(false);
  });

  it("fully deletes a removed standalone event", async () => {
    await store.upsertEvent(fixtureEvent({ uid: "solo-1" }));
    await store.saveSyncState(CONFIG.calendarId, {
      calendarId: CONFIG.calendarId,
      syncToken: "token-1",
      channelId: null,
      resourceId: null,
      channelExpiration: null,
      channelToken: null,
      lastFullSyncAt: new Date().toISOString(),
    });
    provider.incrementalQueue = [
      { events: [removalRaw({ uid: "solo-1", isOccurrence: false })], nextSyncToken: "token-2" },
    ];

    await engine.syncOne(CONFIG, "manual");

    expect((await store.getEvent(CONFIG.source, "solo-1"))?.deleted).toBe(true);
  });

  it("falls back to a full sync when the stored sync token has expired", async () => {
    await store.saveSyncState(CONFIG.calendarId, {
      calendarId: CONFIG.calendarId,
      syncToken: "stale-token",
      channelId: null,
      resourceId: null,
      channelExpiration: null,
      channelToken: null,
      lastFullSyncAt: new Date().toISOString(),
    });
    provider.incrementalQueue = [new SyncTokenExpiredError(CONFIG.calendarId)];
    provider.fullSyncBatches = [{ events: [fixtureEvent({ uid: "a" })], nextSyncToken: "fresh-token" }];

    await engine.syncOne(CONFIG, "manual");

    expect((await store.getEvent(CONFIG.source, "a"))?.uid).toBe("a");
    expect((await store.getSyncState(CONFIG.calendarId))?.syncToken).toBe("fresh-token");
  });

  it("skips sync entirely for a calendar the user has disabled", async () => {
    enablement.overrides[CONFIG.calendarId] = false;
    provider.fullSyncBatches = [{ events: [fixtureEvent({ uid: "a" })], nextSyncToken: "token-1" }];

    await engine.syncOne(CONFIG, "manual");

    expect(provider.fullSyncCallCount).toBe(0);
    expect(await store.getSyncState(CONFIG.calendarId)).toBeNull();
  });

  it("skips an overlapping sync for the same calendar rather than running concurrently", async () => {
    let releaseGate!: () => void;
    provider.fullSyncGate = new Promise((resolve) => (releaseGate = resolve));
    provider.fullSyncBatches = [{ events: [fixtureEvent({ uid: "a" })], nextSyncToken: "token-1" }];

    const first = engine.syncOne(CONFIG, "manual");
    const second = engine.syncOne(CONFIG, "manual");
    // `first` cannot finish until releaseGate() is called below, so `second`
    // resolving here proves it returned early rather than waiting on `first`.
    await second;

    releaseGate();
    await first;

    expect(provider.fullSyncCallCount).toBe(1);
    expect((await store.getEvent(CONFIG.source, "a"))?.uid).toBe("a");
  });

  describe("sync history", () => {
    it("records a full sync with accurate added/deleted counts and per-event changes", async () => {
      await store.upsertEvent(fixtureEvent({ uid: "stale" }));
      provider.fullSyncBatches = [
        { events: [fixtureEvent({ uid: "a" }), fixtureEvent({ uid: "b" })], nextSyncToken: "token-1" },
      ];

      await engine.syncOne(CONFIG, "manual");

      expect(syncRuns.runs).toHaveLength(1);
      const run = syncRuns.runs[0];
      expect(run).toMatchObject({
        calendarId: CONFIG.calendarId,
        source: CONFIG.source,
        type: "full",
        trigger: "manual",
        status: "success",
        totalCount: 2,
        addedCount: 2,
        updatedCount: 0,
        deletedCount: 1,
      });
    });

    it("reports 'updated' only for an event whose fields actually changed on an otherwise-unchanged full resync", async () => {
      await store.upsertEvent(fixtureEvent({ uid: "a", subject: "Original" }));
      provider.fullSyncBatches = [
        { events: [fixtureEvent({ uid: "a", subject: "Renamed" })], nextSyncToken: "token-1" },
      ];

      await engine.syncOne(CONFIG, "manual");

      expect(syncRuns.runs[0]).toMatchObject({ addedCount: 0, updatedCount: 1, deletedCount: 0 });
    });

    it("records a poll-triggered sync even when it found nothing new", async () => {
      await store.saveSyncState(CONFIG.calendarId, {
        calendarId: CONFIG.calendarId,
        syncToken: "token-1",
        channelId: null,
        resourceId: null,
        channelExpiration: null,
        channelToken: null,
        lastFullSyncAt: new Date().toISOString(),
      });
      provider.incrementalQueue = [{ events: [], nextSyncToken: "token-2" }];

      await engine.syncOne(CONFIG, "poll");

      expect(syncRuns.runs).toHaveLength(1);
      expect(syncRuns.runs[0]).toMatchObject({ trigger: "poll", status: "success", totalCount: 0 });
    });

    it("still records a manually-triggered sync even when it turns out to be a no-op", async () => {
      await store.saveSyncState(CONFIG.calendarId, {
        calendarId: CONFIG.calendarId,
        syncToken: "token-1",
        channelId: null,
        resourceId: null,
        channelExpiration: null,
        channelToken: null,
        lastFullSyncAt: new Date().toISOString(),
      });
      provider.incrementalQueue = [{ events: [], nextSyncToken: "token-2" }];

      await engine.syncOne(CONFIG, "manual");

      expect(syncRuns.runs).toHaveLength(1);
      expect(syncRuns.runs[0]).toMatchObject({ trigger: "manual", status: "success", totalCount: 0 });
    });

    it("records an errored run with the failure message, and still propagates the error", async () => {
      provider.fullSyncBatches = [];
      const failure = Promise.reject(new Error("boom"));
      failure.catch(() => {}); // avoid an unhandled-rejection warning between assignment and the await inside fullSync
      provider.fullSyncGate = failure;

      await expect(engine.syncOne(CONFIG, "poll")).rejects.toThrow("boom");

      expect(syncRuns.runs).toHaveLength(1);
      expect(syncRuns.runs[0]).toMatchObject({ status: "error", errorMessage: "boom" });
    });

    it("reports isSyncing while a sync is in flight and clears it once done", async () => {
      let releaseGate!: () => void;
      provider.fullSyncGate = new Promise((resolve) => (releaseGate = resolve));
      provider.fullSyncBatches = [{ events: [fixtureEvent({ uid: "a" })], nextSyncToken: "token-1" }];

      expect(engine.isSyncing(CONFIG.calendarId)).toBe(false);
      const pending = engine.syncOne(CONFIG, "manual");
      expect(engine.isSyncing(CONFIG.calendarId)).toBe(true);

      releaseGate();
      await pending;

      expect(engine.isSyncing(CONFIG.calendarId)).toBe(false);
    });
  });
});
