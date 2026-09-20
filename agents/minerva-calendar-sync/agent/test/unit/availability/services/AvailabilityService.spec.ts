import { execSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { AvailabilityService } from "../../../../src/availability/services/AvailabilityService";
import { CanonicalCalendarEvent } from "../../../../src/domain/canonicalEvent";
import { CalendarBusyInclusionStore } from "../../../../src/store/calendarBusyInclusionStore";
import { PrismaEventOverrideStore } from "../../../../src/store/prisma/PrismaEventOverrideStore";
import { PrismaEventStore } from "../../../../src/store/prisma/PrismaEventStore";
import { PrismaOverrideBlockStore } from "../../../../src/store/prisma/PrismaOverrideBlockStore";
import { PrismaService } from "../../../../src/store/prisma/PrismaService";
import { SyncConfigService } from "../../../../src/sync/services/SyncConfigService";
import { SyncedCalendarConfig } from "../../../../src/sync/syncedCalendarConfig";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

const API_ROOT = join(__dirname, "..", "..", "..", "..");

/** In-memory stand-in — a mutable map tests can flip mid-run rather than a real store. */
class FakeBusyInclusionStore implements CalendarBusyInclusionStore {
  overrides: Record<string, boolean> = {};

  async listOverrides(): Promise<Record<string, boolean>> {
    return this.overrides;
  }

  async setIncludedInBusy(
    calendarId: string,
    includedInBusy: boolean,
  ): Promise<void> {
    this.overrides[calendarId] = includedInBusy;
  }
}

function fakeSyncConfig(calendars: SyncedCalendarConfig[]): SyncConfigService {
  return { getAll: async () => calendars } as unknown as SyncConfigService;
}

function fixtureEvent(
  overrides: Partial<CanonicalCalendarEvent> = {},
): CanonicalCalendarEvent {
  const uid = overrides.uid ?? "uid-1";
  const source = overrides.source ?? "test-source";
  return {
    id: `${source}:${uid}`,
    subject: "Test event",
    sensitivity: "normal",
    importance: "normal",
    occurrenceType: "single",
    type: "meeting",
    reminder: false,
    response: "accepted",
    startTime: "2026-01-05T15:00:00.000Z",
    endTime: "2026-01-05T15:30:00.000Z",
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
    source,
    ...overrides,
  };
}

describe("AvailabilityService", () => {
  let tempDir: string;
  let prisma: PrismaService;
  let events: PrismaEventStore;
  let eventOverrides: PrismaEventOverrideStore;
  let overrideBlocks: PrismaOverrideBlockStore;
  let busyInclusion: FakeBusyInclusionStore;
  let syncedCalendars: SyncedCalendarConfig[];
  let service: AvailabilityService;

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
    await prisma.eventOverride.deleteMany();
    await prisma.overrideBlock.deleteMany();

    events = new PrismaEventStore(prisma);
    eventOverrides = new PrismaEventOverrideStore(prisma);
    overrideBlocks = new PrismaOverrideBlockStore(prisma);
    busyInclusion = new FakeBusyInclusionStore();
    syncedCalendars = [];
    service = new AvailabilityService(
      events,
      eventOverrides,
      overrideBlocks,
      busyInclusion,
      fakeSyncConfig(syncedCalendars),
    );
  });

  afterEach(async () => {
    await prisma.onApplicationShutdown();
  });

  const RANGE_START = "2026-01-05T15:00:00.000Z";
  const RANGE_END = "2026-01-05T16:00:00.000Z"; // 4 slots: :00, :15, :30, :45

  it("is free everywhere with no meetings", async () => {
    const slots = await service.computeSlots(RANGE_START, RANGE_END);
    expect(slots).toHaveLength(4);
    expect(slots.every((s) => s.status === "free")).toBe(true);
    expect(slots[0]).toEqual({
      startTime: "2026-01-05T15:00:00.000Z",
      endTime: "2026-01-05T15:15:00.000Z",
      status: "free",
    });
  });

  it("maps a busy meeting onto exactly the slots it overlaps", async () => {
    await events.upsertEvent(
      fixtureEvent({
        status: "busy",
        startTime: "2026-01-05T15:15:00.000Z",
        endTime: "2026-01-05T15:45:00.000Z",
      }),
    );

    const slots = await service.computeSlots(RANGE_START, RANGE_END);
    expect(slots.map((s) => s.status)).toEqual([
      "free",
      "busy",
      "busy",
      "free",
    ]);
  });

  it("maps tentative to interruptable and out_of_office/working_elsewhere to none", async () => {
    await events.upsertEvent(
      fixtureEvent({
        uid: "tentative",
        status: "tentative",
        startTime: "2026-01-05T15:00:00.000Z",
        endTime: "2026-01-05T15:15:00.000Z",
      }),
    );
    await events.upsertEvent(
      fixtureEvent({
        uid: "ooo",
        status: "out_of_office",
        startTime: "2026-01-05T15:15:00.000Z",
        endTime: "2026-01-05T15:30:00.000Z",
      }),
    );
    await events.upsertEvent(
      fixtureEvent({
        uid: "elsewhere",
        status: "working_elsewhere",
        startTime: "2026-01-05T15:30:00.000Z",
        endTime: "2026-01-05T15:45:00.000Z",
      }),
    );

    const slots = await service.computeSlots(RANGE_START, RANGE_END);
    expect(slots.map((s) => s.status)).toEqual([
      "interruptable",
      "none",
      "none",
      "free",
    ]);
  });

  it("excludes cancelled and deleted events", async () => {
    await events.upsertEvent(
      fixtureEvent({ uid: "cancelled", cancelled: true }),
    );
    await events.upsertEvent(fixtureEvent({ uid: "deleted", deleted: true }));

    const slots = await service.computeSlots(RANGE_START, RANGE_END);
    expect(slots.every((s) => s.status === "free")).toBe(true);
  });

  it("combines overlapping meetings with busy > interruptable > free > none", async () => {
    await events.upsertEvent(
      fixtureEvent({
        uid: "free-one",
        status: "free",
        startTime: "2026-01-05T15:00:00.000Z",
        endTime: "2026-01-05T15:15:00.000Z",
      }),
    );
    await events.upsertEvent(
      fixtureEvent({
        uid: "ooo-one",
        status: "out_of_office",
        startTime: "2026-01-05T15:00:00.000Z",
        endTime: "2026-01-05T15:15:00.000Z",
      }),
    );
    // "free" beats "none" even though nothing here is "busy".
    let slots = await service.computeSlots(
      RANGE_START,
      "2026-01-05T15:15:00.000Z",
    );
    expect(slots[0].status).toBe("free");

    await events.upsertEvent(
      fixtureEvent({
        uid: "busy-one",
        status: "busy",
        startTime: "2026-01-05T15:00:00.000Z",
        endTime: "2026-01-05T15:15:00.000Z",
      }),
    );
    slots = await service.computeSlots(RANGE_START, "2026-01-05T15:15:00.000Z");
    expect(slots[0].status).toBe("busy");
  });

  it("a per-event override replaces that event's contribution to the combine", async () => {
    const event = fixtureEvent({
      status: "busy",
      startTime: "2026-01-05T15:00:00.000Z",
      endTime: "2026-01-05T15:15:00.000Z",
    });
    await events.upsertEvent(event);
    await eventOverrides.setOverride(event.id, "free");

    const slots = await service.computeSlots(
      RANGE_START,
      "2026-01-05T15:15:00.000Z",
    );
    expect(slots[0].status).toBe("free");
  });

  it("an override block wins over both synced status and per-event overrides", async () => {
    const event = fixtureEvent({
      status: "free",
      startTime: "2026-01-05T15:00:00.000Z",
      endTime: "2026-01-05T15:15:00.000Z",
    });
    await events.upsertEvent(event);
    await eventOverrides.setOverride(event.id, "interruptable");
    await overrideBlocks.create({
      startTime: "2026-01-05T15:00:00.000Z",
      endTime: "2026-01-05T15:15:00.000Z",
      status: "busy",
      label: "Focus block",
    });

    const slots = await service.computeSlots(
      RANGE_START,
      "2026-01-05T15:15:00.000Z",
    );
    expect(slots[0].status).toBe("busy");
  });

  it("an override block applies even where no meeting exists", async () => {
    await overrideBlocks.create({
      startTime: "2026-01-05T15:00:00.000Z",
      endTime: "2026-01-05T15:15:00.000Z",
      status: "none",
      label: null,
    });

    const slots = await service.computeSlots(
      RANGE_START,
      "2026-01-05T15:15:00.000Z",
    );
    expect(slots[0].status).toBe("none");
  });

  it("rejects a range where start is not before end", async () => {
    await expect(
      service.computeSlots(RANGE_END, RANGE_START),
    ).rejects.toThrow();
  });

  it("rejects an excessively large range", async () => {
    await expect(
      service.computeSlots(
        "2020-01-01T00:00:00.000Z",
        "2030-01-01T00:00:00.000Z",
      ),
    ).rejects.toThrow();
  });

  describe("busy inclusion", () => {
    it("ignores events from a calendar switched off from busy calculation", async () => {
      syncedCalendars.push({
        provider: "google",
        accountLabel: "work",
        calendarId: "cal-holidays",
        source: "holidays-source",
        enablePush: false,
      });
      busyInclusion.overrides["cal-holidays"] = false;
      await events.upsertEvent(
        fixtureEvent({ source: "holidays-source", status: "busy" }),
      );

      const slots = await service.computeSlots(RANGE_START, RANGE_END);
      expect(slots.every((s) => s.status === "free")).toBe(true);
    });

    it("still counts a calendar with no explicit override (the default)", async () => {
      syncedCalendars.push({
        provider: "google",
        accountLabel: "work",
        calendarId: "cal-holidays",
        source: "holidays-source",
        enablePush: false,
      });
      await events.upsertEvent(
        fixtureEvent({ source: "holidays-source", status: "busy" }),
      );

      const slots = await service.computeSlots(RANGE_START, RANGE_END);
      expect(slots.some((s) => s.status === "busy")).toBe(true);
    });

    it("only excludes the specific calendar switched off, not others", async () => {
      syncedCalendars.push(
        {
          provider: "google",
          accountLabel: "work",
          calendarId: "cal-holidays",
          source: "holidays-source",
          enablePush: false,
        },
        {
          provider: "google",
          accountLabel: "work",
          calendarId: "cal-work",
          source: "test-source",
          enablePush: false,
        },
      );
      busyInclusion.overrides["cal-holidays"] = false;
      await events.upsertEvent(
        fixtureEvent({
          uid: "holiday",
          source: "holidays-source",
          status: "busy",
        }),
      );
      await events.upsertEvent(
        fixtureEvent({ uid: "meeting", source: "test-source", status: "busy" }),
      );

      const slots = await service.computeSlots(RANGE_START, RANGE_END);
      expect(slots.some((s) => s.status === "busy")).toBe(true);
    });

    it("also excludes an excluded calendar's events from computeTimeline", async () => {
      syncedCalendars.push({
        provider: "google",
        accountLabel: "work",
        calendarId: "cal-holidays",
        source: "holidays-source",
        enablePush: false,
      });
      busyInclusion.overrides["cal-holidays"] = false;
      await events.upsertEvent(
        fixtureEvent({
          source: "holidays-source",
          status: "busy",
          startTime: "2026-01-05T15:00:00.000Z",
          endTime: "2026-01-05T15:15:00.000Z",
        }),
      );

      const timeline = await service.computeTimeline(
        "2026-01-05T15:00:00.000Z",
        "2026-01-05T15:15:00.000Z",
      );
      expect(Object.values(timeline)).toEqual(["free"]);
    });
  });

  describe("computeTimeline", () => {
    // 2026-01-05 is a Monday; 2026-01-03/04 are Saturday/Sunday. All times
    // below are UTC, and TZ is pinned to UTC above, so "15:00Z" == 3pm
    // local — within the default 08:00-18:00 window — and the calendar
    // day/weekday match the UTC date directly.
    const MONDAY_START = "2026-01-05T15:00:00.000Z";
    const MONDAY_END = "2026-01-05T16:00:00.000Z"; // 4 slots: :00, :15, :30, :45

    it("is free within the working window with no meetings, keyed by minutes since epoch", async () => {
      const timeline = await service.computeTimeline(MONDAY_START, MONDAY_END);
      const startMinutes = Date.parse(MONDAY_START) / 60_000;

      expect(Object.keys(timeline)).toEqual(
        [0, 15, 30, 45].map((offset) => String(startMinutes + offset)),
      );
      expect(Object.values(timeline).every((status) => status === "free")).toBe(
        true,
      );
    });

    it("maps synced statuses onto the four-level scale, same as computeSlots", async () => {
      await events.upsertEvent(
        fixtureEvent({
          uid: "tentative",
          status: "tentative",
          startTime: "2026-01-05T15:00:00.000Z",
          endTime: "2026-01-05T15:15:00.000Z",
        }),
      );
      await events.upsertEvent(
        fixtureEvent({
          uid: "ooo",
          status: "out_of_office",
          startTime: "2026-01-05T15:15:00.000Z",
          endTime: "2026-01-05T15:30:00.000Z",
        }),
      );
      await events.upsertEvent(
        fixtureEvent({
          uid: "elsewhere",
          status: "working_elsewhere",
          startTime: "2026-01-05T15:30:00.000Z",
          endTime: "2026-01-05T15:45:00.000Z",
        }),
      );
      await events.upsertEvent(
        fixtureEvent({
          uid: "busy",
          status: "busy",
          startTime: "2026-01-05T15:45:00.000Z",
          endTime: "2026-01-05T16:00:00.000Z",
        }),
      );

      const timeline = await service.computeTimeline(MONDAY_START, MONDAY_END);
      expect(Object.values(timeline)).toEqual([
        "interruptable",
        "none",
        "none",
        "busy",
      ]);
    });

    it("a per-event override replaces that event's contribution", async () => {
      const event = fixtureEvent({
        status: "busy",
        startTime: "2026-01-05T15:00:00.000Z",
        endTime: "2026-01-05T15:15:00.000Z",
      });
      await events.upsertEvent(event);
      await eventOverrides.setOverride(event.id, "free");

      const timeline = await service.computeTimeline(
        MONDAY_START,
        "2026-01-05T15:15:00.000Z",
      );
      expect(Object.values(timeline)).toEqual(["free"]);
    });

    it("an override block wins over both a synced status and a per-event override", async () => {
      const event = fixtureEvent({
        status: "free",
        startTime: "2026-01-05T15:00:00.000Z",
        endTime: "2026-01-05T15:15:00.000Z",
      });
      await events.upsertEvent(event);
      await eventOverrides.setOverride(event.id, "interruptable");
      await overrideBlocks.create({
        startTime: "2026-01-05T15:00:00.000Z",
        endTime: "2026-01-05T15:15:00.000Z",
        status: "busy",
        label: "Focus block",
      });

      const timeline = await service.computeTimeline(
        MONDAY_START,
        "2026-01-05T15:15:00.000Z",
      );
      expect(Object.values(timeline)).toEqual(["busy"]);
    });

    it("excludes cancelled and deleted events", async () => {
      await events.upsertEvent(
        fixtureEvent({ uid: "cancelled", cancelled: true }),
      );
      await events.upsertEvent(fixtureEvent({ uid: "deleted", deleted: true }));

      const timeline = await service.computeTimeline(MONDAY_START, MONDAY_END);
      expect(Object.values(timeline).every((status) => status === "free")).toBe(
        true,
      );
    });

    it("rejects a range where start is not before end", async () => {
      await expect(
        service.computeTimeline(MONDAY_END, MONDAY_START),
      ).rejects.toThrow();
    });

    describe("the day-start/day-end window", () => {
      it("shows a synced meeting before the default 08:00 start as none", async () => {
        await events.upsertEvent(
          fixtureEvent({
            status: "busy",
            startTime: "2026-01-05T06:00:00.000Z",
            endTime: "2026-01-05T06:15:00.000Z",
          }),
        );

        const timeline = await service.computeTimeline(
          "2026-01-05T06:00:00.000Z",
          "2026-01-05T06:15:00.000Z",
        );
        expect(Object.values(timeline)).toEqual(["none"]);
      });

      it("shows a synced meeting at/after the default 18:00 end as none", async () => {
        await events.upsertEvent(
          fixtureEvent({
            status: "busy",
            startTime: "2026-01-05T18:00:00.000Z",
            endTime: "2026-01-05T18:15:00.000Z",
          }),
        );

        const timeline = await service.computeTimeline(
          "2026-01-05T18:00:00.000Z",
          "2026-01-05T18:15:00.000Z",
        );
        expect(Object.values(timeline)).toEqual(["none"]);
      });

      it("still shows the real status for the last slot before 18:00 (the window's end is exclusive)", async () => {
        await events.upsertEvent(
          fixtureEvent({
            status: "busy",
            startTime: "2026-01-05T17:45:00.000Z",
            endTime: "2026-01-05T18:00:00.000Z",
          }),
        );

        const timeline = await service.computeTimeline(
          "2026-01-05T17:45:00.000Z",
          "2026-01-05T18:00:00.000Z",
        );
        expect(Object.values(timeline)).toEqual(["busy"]);
      });

      it("uses an override's own status outside the window instead of none", async () => {
        await overrideBlocks.create({
          startTime: "2026-01-05T06:00:00.000Z",
          endTime: "2026-01-05T06:15:00.000Z",
          status: "interruptable",
          label: null,
        });

        const timeline = await service.computeTimeline(
          "2026-01-05T06:00:00.000Z",
          "2026-01-05T06:15:00.000Z",
        );
        expect(Object.values(timeline)).toEqual(["interruptable"]);
      });

      it("a per-event override outside the window also shows through, ignoring the event's own synced status", async () => {
        const event = fixtureEvent({
          status: "busy",
          startTime: "2026-01-05T06:00:00.000Z",
          endTime: "2026-01-05T06:15:00.000Z",
        });
        await events.upsertEvent(event);
        await eventOverrides.setOverride(event.id, "free");

        const timeline = await service.computeTimeline(
          "2026-01-05T06:00:00.000Z",
          "2026-01-05T06:15:00.000Z",
        );
        expect(Object.values(timeline)).toEqual(["free"]);
      });

      it("honors custom dayStart/dayEnd", async () => {
        await events.upsertEvent(
          fixtureEvent({
            status: "busy",
            startTime: "2026-01-05T08:00:00.000Z",
            endTime: "2026-01-05T08:15:00.000Z",
          }),
        );

        const defaultWindow = await service.computeTimeline(
          "2026-01-05T08:00:00.000Z",
          "2026-01-05T08:15:00.000Z",
        );
        expect(Object.values(defaultWindow)).toEqual(["busy"]);

        const customWindow = await service.computeTimeline(
          "2026-01-05T08:00:00.000Z",
          "2026-01-05T08:15:00.000Z",
          {
            dayStart: "09:00",
            dayEnd: "17:00",
          },
        );
        expect(Object.values(customWindow)).toEqual(["none"]);
      });

      it("rejects dayStart at or after dayEnd", async () => {
        await expect(
          service.computeTimeline(MONDAY_START, MONDAY_END, {
            dayStart: "18:00",
            dayEnd: "08:00",
          }),
        ).rejects.toThrow();
      });

      it("rejects a malformed dayStart", async () => {
        await expect(
          service.computeTimeline(MONDAY_START, MONDAY_END, {
            dayStart: "not-a-time",
          }),
        ).rejects.toThrow();
      });
    });

    describe("weekends", () => {
      const SATURDAY_START = "2026-01-03T15:00:00.000Z";
      const SATURDAY_END = "2026-01-03T15:15:00.000Z";

      it("shows a weekend synced meeting as none by default", async () => {
        await events.upsertEvent(
          fixtureEvent({
            status: "busy",
            startTime: SATURDAY_START,
            endTime: SATURDAY_END,
          }),
        );

        const timeline = await service.computeTimeline(
          SATURDAY_START,
          SATURDAY_END,
        );
        expect(Object.values(timeline)).toEqual(["none"]);
      });

      it("shows an override on a weekend regardless of the default", async () => {
        await overrideBlocks.create({
          startTime: SATURDAY_START,
          endTime: SATURDAY_END,
          status: "busy",
          label: null,
        });

        const timeline = await service.computeTimeline(
          SATURDAY_START,
          SATURDAY_END,
        );
        expect(Object.values(timeline)).toEqual(["busy"]);
      });

      it("computes weekends the same as weekdays when treatWeekendsAsWorking is set", async () => {
        await events.upsertEvent(
          fixtureEvent({
            status: "busy",
            startTime: SATURDAY_START,
            endTime: SATURDAY_END,
          }),
        );

        const timeline = await service.computeTimeline(
          SATURDAY_START,
          SATURDAY_END,
          { treatWeekendsAsWorking: true },
        );
        expect(Object.values(timeline)).toEqual(["busy"]);
      });

      it("with treatWeekendsAsWorking set, an empty weekend slot is free like a weekday", async () => {
        const timeline = await service.computeTimeline(
          SATURDAY_START,
          SATURDAY_END,
          { treatWeekendsAsWorking: true },
        );
        expect(Object.values(timeline)).toEqual(["free"]);
      });

      it("still applies the day-start/day-end window to a weekend treated as working", async () => {
        const earlySaturday = {
          start: "2026-01-03T06:00:00.000Z",
          end: "2026-01-03T06:15:00.000Z",
        };
        await events.upsertEvent(
          fixtureEvent({
            status: "busy",
            startTime: earlySaturday.start,
            endTime: earlySaturday.end,
          }),
        );

        const timeline = await service.computeTimeline(
          earlySaturday.start,
          earlySaturday.end,
          {
            treatWeekendsAsWorking: true,
          },
        );
        expect(Object.values(timeline)).toEqual(["none"]);
      });
    });

    describe("timezone", () => {
      it("defaults to UTC when omitted", async () => {
        // 19:00 UTC is outside the default 08:00-18:00 window in UTC.
        await events.upsertEvent(
          fixtureEvent({
            status: "busy",
            startTime: "2026-01-05T19:00:00.000Z",
            endTime: "2026-01-05T19:15:00.000Z",
          }),
        );

        const timeline = await service.computeTimeline(
          "2026-01-05T19:00:00.000Z",
          "2026-01-05T19:15:00.000Z",
        );
        expect(Object.values(timeline)).toEqual(["none"]);
      });

      it("evaluates the day-start/day-end window in the given timezone instead of UTC", async () => {
        // 19:00 UTC on 2026-01-05 is 11:00 in America/Los_Angeles (UTC-8 in
        // January) — inside the default window there, though outside it in UTC.
        await events.upsertEvent(
          fixtureEvent({
            status: "busy",
            startTime: "2026-01-05T19:00:00.000Z",
            endTime: "2026-01-05T19:15:00.000Z",
          }),
        );

        const timeline = await service.computeTimeline(
          "2026-01-05T19:00:00.000Z",
          "2026-01-05T19:15:00.000Z",
          {
            timezone: "America/Los_Angeles",
          },
        );
        expect(Object.values(timeline)).toEqual(["busy"]);
      });

      it("evaluates weekday in the given timezone instead of UTC", async () => {
        // 2026-01-04 23:00 UTC is Sunday night in UTC, but already Monday
        // 08:00 in Asia/Tokyo (UTC+9) — a weekday there, and the very start
        // of the default working window.
        await events.upsertEvent(
          fixtureEvent({
            status: "busy",
            startTime: "2026-01-04T23:00:00.000Z",
            endTime: "2026-01-04T23:15:00.000Z",
          }),
        );

        const utc = await service.computeTimeline(
          "2026-01-04T23:00:00.000Z",
          "2026-01-04T23:15:00.000Z",
        );
        expect(Object.values(utc)).toEqual(["none"]);

        const tokyo = await service.computeTimeline(
          "2026-01-04T23:00:00.000Z",
          "2026-01-04T23:15:00.000Z",
          {
            timezone: "Asia/Tokyo",
          },
        );
        expect(Object.values(tokyo)).toEqual(["busy"]);
      });

      it("rejects an unrecognized timezone", async () => {
        await expect(
          service.computeTimeline(MONDAY_START, MONDAY_END, {
            timezone: "Not/AZone",
          }),
        ).rejects.toThrow();
      });
    });
  });
});
