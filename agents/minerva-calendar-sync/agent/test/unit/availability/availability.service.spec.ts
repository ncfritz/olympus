import { execSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { AvailabilityService } from "../../../src/availability/availability.service";
import { CanonicalCalendarEvent } from "../../../src/domain/canonical-event";
import { PrismaEventOverrideStore } from "../../../src/store/prisma/prisma-event-override-store";
import { PrismaEventStore } from "../../../src/store/prisma/prisma-event-store";
import { PrismaOverrideBlockStore } from "../../../src/store/prisma/prisma-override-block-store";
import { PrismaService } from "../../../src/store/prisma/prisma.service";

const API_ROOT = join(__dirname, "..", "..", "..");

function fixtureEvent(overrides: Partial<CanonicalCalendarEvent> = {}): CanonicalCalendarEvent {
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
  let service: AvailabilityService;

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
    await prisma.eventOverride.deleteMany();
    await prisma.overrideBlock.deleteMany();

    events = new PrismaEventStore(prisma);
    eventOverrides = new PrismaEventOverrideStore(prisma);
    overrideBlocks = new PrismaOverrideBlockStore(prisma);
    service = new AvailabilityService(events, eventOverrides, overrideBlocks);
  });

  afterEach(async () => {
    await prisma.onModuleDestroy();
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
      fixtureEvent({ status: "busy", startTime: "2026-01-05T15:15:00.000Z", endTime: "2026-01-05T15:45:00.000Z" }),
    );

    const slots = await service.computeSlots(RANGE_START, RANGE_END);
    expect(slots.map((s) => s.status)).toEqual(["free", "busy", "busy", "free"]);
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
    expect(slots.map((s) => s.status)).toEqual(["interruptable", "none", "none", "free"]);
  });

  it("excludes cancelled and deleted events", async () => {
    await events.upsertEvent(fixtureEvent({ uid: "cancelled", cancelled: true }));
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
    let slots = await service.computeSlots(RANGE_START, "2026-01-05T15:15:00.000Z");
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

    const slots = await service.computeSlots(RANGE_START, "2026-01-05T15:15:00.000Z");
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

    const slots = await service.computeSlots(RANGE_START, "2026-01-05T15:15:00.000Z");
    expect(slots[0].status).toBe("busy");
  });

  it("an override block applies even where no meeting exists", async () => {
    await overrideBlocks.create({
      startTime: "2026-01-05T15:00:00.000Z",
      endTime: "2026-01-05T15:15:00.000Z",
      status: "none",
      label: null,
    });

    const slots = await service.computeSlots(RANGE_START, "2026-01-05T15:15:00.000Z");
    expect(slots[0].status).toBe("none");
  });

  it("rejects a range where start is not before end", async () => {
    await expect(service.computeSlots(RANGE_END, RANGE_START)).rejects.toThrow();
  });

  it("rejects an excessively large range", async () => {
    await expect(service.computeSlots("2020-01-01T00:00:00.000Z", "2030-01-01T00:00:00.000Z")).rejects.toThrow();
  });
});
