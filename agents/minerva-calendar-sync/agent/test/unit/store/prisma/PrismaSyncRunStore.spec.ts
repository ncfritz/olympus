import { execSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { NewSyncRun } from "../../../../src/domain/syncRun";
import { PrismaSyncRunStore } from "../../../../src/store/prisma/PrismaSyncRunStore";
import { PrismaService } from "../../../../src/store/prisma/PrismaService";
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

function fixtureRun(overrides: Partial<NewSyncRun> = {}): NewSyncRun {
  return {
    calendarId: "cal-1",
    source: "personal-gmail",
    type: "incremental",
    trigger: "poll",
    status: "success",
    startedAt: "2026-01-05T15:00:00.000Z",
    finishedAt: "2026-01-05T15:00:01.000Z",
    totalCount: 0,
    addedCount: 0,
    updatedCount: 0,
    deletedCount: 0,
    errorMessage: null,
    changes: [],
    ...overrides,
  };
}

describe("PrismaSyncRunStore", () => {
  let tempDir: string;
  let prisma: PrismaService;
  let store: PrismaSyncRunStore;

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
    await prisma.syncRunEventChange.deleteMany();
    await prisma.syncRun.deleteMany();
    store = new PrismaSyncRunStore(prisma);
  });

  afterEach(async () => {
    await prisma.onModuleDestroy();
  });

  it("create persists a run and its event changes, and get returns both", async () => {
    const created = await store.create(
      fixtureRun({
        addedCount: 1,
        totalCount: 1,
        changes: [
          {
            action: "added",
            eventId: "personal-gmail:uid-1",
            subject: "Team sync",
            startTime: "2026-01-05T16:00:00.000Z",
          },
        ],
      }),
    );

    const fetched = await store.get(created.id);
    expect(fetched?.changes).toEqual([
      {
        action: "added",
        eventId: "personal-gmail:uid-1",
        subject: "Team sync",
        startTime: "2026-01-05T16:00:00.000Z",
      },
    ]);
  });

  it("get returns null for an unknown id", async () => {
    expect(await store.get("missing")).toBeNull();
  });

  it("list filters by calendarId, type, trigger, and status", async () => {
    await store.create(
      fixtureRun({
        calendarId: "cal-1",
        trigger: "poll",
        type: "incremental",
        status: "success",
      }),
    );
    await store.create(
      fixtureRun({
        calendarId: "cal-2",
        trigger: "manual",
        type: "full",
        status: "error",
        errorMessage: "boom",
      }),
    );

    expect(
      (await store.list({ calendarId: "cal-1" })).map((r) => r.calendarId),
    ).toEqual(["cal-1"]);
    expect(
      (await store.list({ trigger: "manual" })).map((r) => r.calendarId),
    ).toEqual(["cal-2"]);
    expect(
      (await store.list({ type: "full" })).map((r) => r.calendarId),
    ).toEqual(["cal-2"]);
    expect(
      (await store.list({ status: "error" })).map((r) => r.calendarId),
    ).toEqual(["cal-2"]);
    expect(await store.list({})).toHaveLength(2);
  });

  it("list orders by most recent first", async () => {
    await store.create(
      fixtureRun({
        startedAt: "2026-01-05T15:00:00.000Z",
        finishedAt: "2026-01-05T15:00:01.000Z",
      }),
    );
    await store.create(
      fixtureRun({
        startedAt: "2026-01-06T15:00:00.000Z",
        finishedAt: "2026-01-06T15:00:01.000Z",
      }),
    );

    const runs = await store.list({});
    expect(runs.map((r) => r.startedAt)).toEqual([
      "2026-01-06T15:00:00.000Z",
      "2026-01-05T15:00:00.000Z",
    ]);
  });

  it("pruneFinishedBefore deletes only runs that finished before the cutoff", async () => {
    await store.create(fixtureRun({ finishedAt: "2026-01-01T00:00:00.000Z" }));
    await store.create(fixtureRun({ finishedAt: "2026-06-01T00:00:00.000Z" }));

    const deleted = await store.pruneFinishedBefore(
      new Date("2026-03-01T00:00:00.000Z"),
    );

    expect(deleted).toBe(1);
    expect(await store.list({})).toHaveLength(1);
  });

  describe("dailyStats", () => {
    it("buckets by day and calendar, averaging duration and summing counts", async () => {
      // Two runs for cal-1 on the same day: durations 1000ms and 3000ms average to 2000ms; counts sum.
      await store.create(
        fixtureRun({
          calendarId: "cal-1",
          startedAt: "2026-01-05T08:00:00.000Z",
          finishedAt: "2026-01-05T08:00:01.000Z",
          status: "success",
          totalCount: 2,
          addedCount: 1,
          updatedCount: 1,
        }),
      );
      await store.create(
        fixtureRun({
          calendarId: "cal-1",
          startedAt: "2026-01-05T20:00:00.000Z",
          finishedAt: "2026-01-05T20:00:03.000Z",
          status: "error",
          totalCount: 1,
          deletedCount: 1,
        }),
      );
      // A different calendar, same day — should be its own bucket.
      await store.create(
        fixtureRun({
          calendarId: "cal-2",
          startedAt: "2026-01-05T09:00:00.000Z",
          finishedAt: "2026-01-05T09:00:00.500Z",
        }),
      );

      const stats = await store.dailyStats({
        since: "2026-01-01T00:00:00.000Z",
      });

      expect(stats).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            date: "2026-01-05",
            calendarId: "cal-1",
            runCount: 2,
            successCount: 1,
            errorCount: 1,
            avgDurationMs: 2000,
            totalCount: 3,
            addedCount: 1,
            updatedCount: 1,
            deletedCount: 1,
          }),
          expect.objectContaining({
            date: "2026-01-05",
            calendarId: "cal-2",
            runCount: 1,
          }),
        ]),
      );
      expect(stats).toHaveLength(2);
    });

    it("excludes runs that started before the since cutoff", async () => {
      await store.create(
        fixtureRun({
          startedAt: "2025-12-01T00:00:00.000Z",
          finishedAt: "2025-12-01T00:00:01.000Z",
        }),
      );
      await store.create(
        fixtureRun({
          startedAt: "2026-01-05T00:00:00.000Z",
          finishedAt: "2026-01-05T00:00:01.000Z",
        }),
      );

      const stats = await store.dailyStats({
        since: "2026-01-01T00:00:00.000Z",
      });

      expect(stats.map((s) => s.date)).toEqual(["2026-01-05"]);
    });

    it("applies the same type/trigger/status/calendarId filters as list", async () => {
      await store.create(fixtureRun({ calendarId: "cal-1", trigger: "poll" }));
      await store.create(
        fixtureRun({ calendarId: "cal-2", trigger: "manual" }),
      );

      const stats = await store.dailyStats({
        since: "2026-01-01T00:00:00.000Z",
        trigger: "manual",
      });

      expect(stats.map((s) => s.calendarId)).toEqual(["cal-2"]);
    });
  });
});
