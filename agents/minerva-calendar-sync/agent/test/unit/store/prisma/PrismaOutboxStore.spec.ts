import { execSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import type { CanonicalCalendarEvent } from "../../../../src/domain/canonicalEvent";
import { PrismaOutboxStore } from "../../../../src/store/prisma/PrismaOutboxStore";
import { PrismaService } from "../../../../src/store/prisma/PrismaService";

const API_ROOT = join(__dirname, "..", "..", "..", "..");

const event = (uid: string): CanonicalCalendarEvent => ({
  id: `work:${uid}`,
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
  location: null,
  cancelled: false,
  organizerEmail: null,
  deleted: false,
  uid,
  recurrenceId: null,
  recurrenceRule: null,
  source: "work",
});

describe("PrismaOutboxStore", () => {
  let tempDir: string;
  let prisma: PrismaService;
  let store: PrismaOutboxStore;

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
    await prisma.outboxEvent.deleteMany();
    store = new PrismaOutboxStore(prisma);
  });

  afterEach(async () => {
    await prisma.onApplicationShutdown();
  });

  it("queues a backfill as snapshots taken together, stamped with when", async () => {
    const before = Date.now();

    expect(await store.enqueueBackfill("work", [event("a"), event("b")])).toBe(
      2,
    );

    const rows = await prisma.outboxEvent.findMany({
      orderBy: { eventId: "asc" },
    });
    expect(rows.map((r) => [r.eventId, r.action])).toEqual([
      ["work:a", "backfill"],
      ["work:b", "backfill"],
    ]);
    const stamps = rows.map((r) => JSON.parse(r.payload).snapshotTime);
    expect(new Set(stamps).size).toBe(1);
    expect(Date.parse(stamps[0])).toBeGreaterThanOrEqual(before);
    expect(JSON.parse(rows[0]!.payload)).toMatchObject({
      id: "work:a",
      subject: "Team sync",
    });
  });
});
