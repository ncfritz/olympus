import { execSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { CanonicalCalendarEvent } from "../../../../src/domain/canonical-event";
import { PrismaEventStore } from "../../../../src/store/prisma/prisma-event-store";
import { PrismaService } from "../../../../src/store/prisma/prisma.service";

const API_ROOT = join(__dirname, "..", "..", "..", "..");

function fixtureEvent(overrides: Partial<CanonicalCalendarEvent> = {}): CanonicalCalendarEvent {
  const uid = overrides.uid ?? "uid-1";
  const source = overrides.source ?? "personal-gmail";
  return {
    id: `${source}:${uid}`,
    subject: "Team sync",
    sensitivity: "normal",
    importance: "normal",
    occurrenceType: "single",
    type: "meeting",
    reminder: true,
    response: "accepted",
    startTime: "2026-01-05T15:00:00.000Z",
    endTime: "2026-01-05T15:30:00.000Z",
    duration: 30,
    allDay: false,
    status: "busy",
    location: "Zoom",
    cancelled: false,
    organizerEmail: "organizer@example.com",
    deleted: false,
    uid: "uid-1",
    recurrenceId: null,
    source: "personal-gmail",
    ...overrides,
  };
}

describe("PrismaEventStore", () => {
  let tempDir: string;
  let prisma: PrismaService;
  let store: PrismaEventStore;

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
  });

  afterEach(async () => {
    await prisma.onModuleDestroy();
  });

  it("round-trips an event through upsert and get", async () => {
    const event = fixtureEvent();
    await store.upsertEvent(event);

    const found = await store.getEvent(event.source, event.uid);
    expect(found).toEqual(event);
  });

  it("upsert on the same source+uid updates in place rather than duplicating", async () => {
    const event = fixtureEvent();
    await store.upsertEvent(event);
    await store.upsertEvent({ ...event, subject: "Team sync (rescheduled)", startTime: "2026-01-06T15:00:00.000Z" });

    const all = await store.listEvents({ source: event.source });
    expect(all).toHaveLength(1);
    expect(all[0].subject).toBe("Team sync (rescheduled)");
  });

  it("marks an event cancelled without deleting the row", async () => {
    const event = fixtureEvent();
    await store.upsertEvent(event);

    await store.markCancelled(event.source, event.uid);

    const found = await store.getEvent(event.source, event.uid);
    expect(found?.cancelled).toBe(true);
    expect(found?.deleted).toBe(false);
  });

  it("soft-deletes an event: the row stays with deleted = true", async () => {
    const event = fixtureEvent();
    await store.upsertEvent(event);

    await store.markDeleted(event.source, event.uid);

    const found = await store.getEvent(event.source, event.uid);
    expect(found).not.toBeNull();
    expect(found?.deleted).toBe(true);
  });

  it("filters listEvents by source, cancelled, and deleted", async () => {
    await store.upsertEvent(fixtureEvent({ uid: "uid-a", source: "cal-a" }));
    await store.upsertEvent(fixtureEvent({ uid: "uid-b", source: "cal-a", cancelled: true }));
    await store.upsertEvent(fixtureEvent({ uid: "uid-c", source: "cal-b" }));

    const calAOnly = await store.listEvents({ source: "cal-a" });
    expect(calAOnly.map((e) => e.uid).sort()).toEqual(["uid-a", "uid-b"]);

    const cancelledOnly = await store.listEvents({ source: "cal-a", cancelled: true });
    expect(cancelledOnly.map((e) => e.uid)).toEqual(["uid-b"]);
  });

  it("orders listEvents by most recent/upcoming first, so a capped limit doesn't bury recent events under old history", async () => {
    await store.upsertEvent(fixtureEvent({ uid: "old", startTime: "2009-01-01T00:00:00.000Z" }));
    await store.upsertEvent(fixtureEvent({ uid: "recent", startTime: "2026-01-01T00:00:00.000Z" }));
    await store.upsertEvent(fixtureEvent({ uid: "middle", startTime: "2018-01-01T00:00:00.000Z" }));

    const capped = await store.listEvents({ source: "personal-gmail", limit: 2 });
    expect(capped.map((e) => e.uid)).toEqual(["recent", "middle"]);
  });

  it("round-trips sync state", async () => {
    const calendarId = "primary";
    expect(await store.getSyncState(calendarId)).toBeNull();

    await store.saveSyncState(calendarId, {
      calendarId,
      syncToken: "token-1",
      channelId: "chan-1",
      resourceId: "res-1",
      channelExpiration: "2026-02-01T00:00:00.000Z",
      channelToken: "secret-1",
    });

    const state = await store.getSyncState(calendarId);
    expect(state).toEqual({
      calendarId,
      syncToken: "token-1",
      channelId: "chan-1",
      resourceId: "res-1",
      channelExpiration: "2026-02-01T00:00:00.000Z",
      channelToken: "secret-1",
    });

    await store.saveSyncState(calendarId, { ...state!, syncToken: "token-2" });
    expect((await store.getSyncState(calendarId))?.syncToken).toBe("token-2");
  });
});
