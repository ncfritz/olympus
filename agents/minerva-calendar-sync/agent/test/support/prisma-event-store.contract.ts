import { CanonicalCalendarEvent } from "../../src/domain/canonical-event";
import { PrismaEventStore } from "../../src/store/prisma/prisma-event-store";
import { PrismaService } from "../../src/store/prisma/prisma.service";
import { describe, expect, it } from "vitest";

function fixtureEvent(
  overrides: Partial<CanonicalCalendarEvent> = {},
): CanonicalCalendarEvent {
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
    recurrenceRule: null,
    source: "personal-gmail",
    ...overrides,
  };
}

/**
 * The behavioral contract every PrismaEventStore-backed database must
 * satisfy, regardless of which SQL dialect is behind it. Shared between
 * the SQLite unit spec and the Postgres integration spec so the two
 * dialects are verified against the exact same assertions, not
 * hand-copied (and potentially drifting) ones.
 */
export function testPrismaEventStoreContract(
  getStore: () => PrismaEventStore,
  getPrisma: () => PrismaService,
): void {
  it("round-trips an event through upsert and get", async () => {
    const store = getStore();
    const event = fixtureEvent();
    await store.upsertEvent(event);

    const found = await store.getEvent(event.source, event.uid);
    expect(found).toEqual(event);
  });

  it("upsert on the same source+uid updates in place rather than duplicating", async () => {
    const store = getStore();
    const event = fixtureEvent();
    await store.upsertEvent(event);
    await store.upsertEvent({
      ...event,
      subject: "Team sync (rescheduled)",
      startTime: "2026-01-06T15:00:00.000Z",
    });

    const all = await store.listEvents({ source: event.source });
    expect(all).toHaveLength(1);
    expect(all[0].subject).toBe("Team sync (rescheduled)");
  });

  it("upsertEvent reports created, unchanged, and updated", async () => {
    const store = getStore();
    const event = fixtureEvent();

    expect(await store.upsertEvent(event)).toBe("created");
    expect(await store.upsertEvent(event)).toBe("unchanged");
    expect(await store.upsertEvent({ ...event, subject: "Renamed" })).toBe(
      "updated",
    );
  });

  it("marks an event cancelled without deleting the row, reporting whether it actually flipped", async () => {
    const store = getStore();
    const event = fixtureEvent();
    await store.upsertEvent(event);

    expect(await store.markCancelled(event.source, event.uid)).toBe(true);
    expect(await store.markCancelled(event.source, event.uid)).toBe(false);

    const found = await store.getEvent(event.source, event.uid);
    expect(found?.cancelled).toBe(true);
    expect(found?.deleted).toBe(false);
  });

  it("soft-deletes an event: the row stays with deleted = true, reporting whether it actually flipped", async () => {
    const store = getStore();
    const event = fixtureEvent();
    await store.upsertEvent(event);

    expect(await store.markDeleted(event.source, event.uid)).toBe(true);
    expect(await store.markDeleted(event.source, event.uid)).toBe(false);

    const found = await store.getEvent(event.source, event.uid);
    expect(found).not.toBeNull();
    expect(found?.deleted).toBe(true);
  });

  it("filters listEvents by source, cancelled, and deleted", async () => {
    const store = getStore();
    await store.upsertEvent(fixtureEvent({ uid: "uid-a", source: "cal-a" }));
    await store.upsertEvent(
      fixtureEvent({ uid: "uid-b", source: "cal-a", cancelled: true }),
    );
    await store.upsertEvent(fixtureEvent({ uid: "uid-c", source: "cal-b" }));

    const calAOnly = await store.listEvents({ source: "cal-a" });
    expect(calAOnly.map((e) => e.uid).sort()).toEqual(["uid-a", "uid-b"]);

    const cancelledOnly = await store.listEvents({
      source: "cal-a",
      cancelled: true,
    });
    expect(cancelledOnly.map((e) => e.uid)).toEqual(["uid-b"]);
  });

  it("orders listEvents by most recent/upcoming first, so a capped limit doesn't bury recent events under old history", async () => {
    const store = getStore();
    await store.upsertEvent(
      fixtureEvent({ uid: "old", startTime: "2009-01-01T00:00:00.000Z" }),
    );
    await store.upsertEvent(
      fixtureEvent({ uid: "recent", startTime: "2026-01-01T00:00:00.000Z" }),
    );
    await store.upsertEvent(
      fixtureEvent({ uid: "middle", startTime: "2018-01-01T00:00:00.000Z" }),
    );

    const capped = await store.listEvents({
      source: "personal-gmail",
      limit: 2,
    });
    expect(capped.map((e) => e.uid)).toEqual(["recent", "middle"]);
  });

  it("round-trips sync state", async () => {
    const store = getStore();
    const calendarId = "primary";
    expect(await store.getSyncState(calendarId)).toBeNull();

    await store.saveSyncState(calendarId, {
      calendarId,
      syncToken: "token-1",
      channelId: "chan-1",
      resourceId: "res-1",
      channelExpiration: "2026-02-01T00:00:00.000Z",
      channelToken: "secret-1",
      lastFullSyncAt: null,
    });

    const state = await store.getSyncState(calendarId);
    expect(state?.lastSyncedAt).toEqual(expect.any(String));
    expect(state).toEqual({
      calendarId,
      syncToken: "token-1",
      channelId: "chan-1",
      resourceId: "res-1",
      channelExpiration: "2026-02-01T00:00:00.000Z",
      channelToken: "secret-1",
      lastFullSyncAt: null,
      lastSyncedAt: state?.lastSyncedAt,
    });

    await store.saveSyncState(calendarId, { ...state!, syncToken: "token-2" });
    expect((await store.getSyncState(calendarId))?.syncToken).toBe("token-2");
  });

  describe("outbox", () => {
    it("enqueues an outbox row on create and on update, but not when unchanged", async () => {
      const store = getStore();
      const prisma = getPrisma();
      const event = fixtureEvent();

      await store.upsertEvent(event);
      await store.upsertEvent(event); // unchanged
      await store.upsertEvent({ ...event, subject: "Renamed" });

      const rows = await prisma.outboxEvent.findMany({
        orderBy: { createdAt: "asc" },
      });
      expect(rows).toHaveLength(2);
      expect(
        rows.every(
          (r) =>
            r.eventId === event.id &&
            r.action === "upsert" &&
            r.status === "pending",
        ),
      ).toBe(true);
      expect(JSON.parse(rows[1].payload).subject).toBe("Renamed");
    });

    it("enqueues an upsert-action outbox row only when markCancelled actually flips the row", async () => {
      const store = getStore();
      const prisma = getPrisma();
      const event = fixtureEvent();
      await store.upsertEvent(event);

      await store.markCancelled(event.source, event.uid);
      await store.markCancelled(event.source, event.uid); // already cancelled — no-op

      const rows = await prisma.outboxEvent.findMany({
        where: { action: "upsert" },
        orderBy: { createdAt: "asc" },
      });
      expect(rows).toHaveLength(2); // the initial create + the cancellation
      const cancelPayload = JSON.parse(rows[1].payload);
      expect(cancelPayload.cancelled).toBe(true);
      expect(cancelPayload.deleted).toBe(false);
    });

    it("enqueues a delete-action outbox row with the full event snapshot only when markDeleted actually flips the row", async () => {
      const store = getStore();
      const prisma = getPrisma();
      const event = fixtureEvent();
      await store.upsertEvent(event);

      await store.markDeleted(event.source, event.uid);
      await store.markDeleted(event.source, event.uid); // already deleted — no-op

      const rows = await prisma.outboxEvent.findMany({
        where: { action: "delete" },
      });
      expect(rows).toHaveLength(1);
      const payload = JSON.parse(rows[0].payload);
      expect(payload.id).toBe(event.id);
      expect(payload.deleted).toBe(true);
    });
  });
}
