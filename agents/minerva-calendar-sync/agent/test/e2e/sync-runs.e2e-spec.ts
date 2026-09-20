import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../../src/AppModule";
import { configureApp } from "../../src/configureApp";
import type { NewSyncRun, SyncRun } from "../../src/domain/syncRun";
import {
  SYNC_RUN_STORE,
  type SyncRunStore,
} from "../../src/store/syncRunStore";
import { issueE2eAccessToken } from "./auth-fixtures";

describe("Sync runs (e2e)", () => {
  let app: INestApplication;
  let authHeader: string;
  let calendarId: string;
  let calendarCount = 0;

  const hoursAgo = (hours: number) =>
    new Date(Date.now() - hours * 3_600_000).toISOString();

  const record = (overrides: Partial<NewSyncRun> = {}): Promise<SyncRun> =>
    app.get<SyncRunStore>(SYNC_RUN_STORE).create({
      calendarId,
      source: "google:work",
      type: "incremental",
      trigger: "poll",
      status: "success",
      startedAt: hoursAgo(2),
      finishedAt: hoursAgo(1.99),
      totalCount: 1,
      addedCount: 1,
      updatedCount: 0,
      deletedCount: 0,
      errorMessage: null,
      changes: [],
      ...overrides,
    });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    authHeader = `Bearer ${issueE2eAccessToken(app)}`;
    // The database is shared by the tests in this file.
    calendarId = `calendar-${++calendarCount}`;
  });

  afterEach(async () => {
    await app.close();
  });

  it("rejects requests with no access token", async () => {
    await request(app.getHttpServer()).get("/v1/sync-runs").expect(401);
  });

  it("lists runs newest first, filtered and paged", async () => {
    const older = await record({
      startedAt: hoursAgo(3),
      finishedAt: hoursAgo(2.9),
    });
    const failed = await record({
      status: "error",
      errorMessage: "provider unavailable",
      totalCount: 0,
      addedCount: 0,
    });

    const all = await request(app.getHttpServer())
      .get(`/v1/sync-runs?calendarId=${calendarId}`)
      .set("Authorization", authHeader)
      .expect(200);
    expect(all.body.syncRuns.map((r: SyncRun) => r.id)).toEqual([
      failed.id,
      older.id,
    ]);
    expect(all.body.syncRuns[0]).toMatchObject({
      calendarId,
      status: "error",
      errorMessage: "provider unavailable",
      startedAt: failed.startedAt,
    });
    expect(all.body.syncRuns[1]).not.toHaveProperty("errorMessage");

    const errors = await request(app.getHttpServer())
      .get(`/v1/sync-runs?calendarId=${calendarId}&status=error`)
      .set("Authorization", authHeader)
      .expect(200);
    expect(errors.body.syncRuns.map((r: SyncRun) => r.id)).toEqual([failed.id]);

    const page = await request(app.getHttpServer())
      .get(`/v1/sync-runs?calendarId=${calendarId}&limit=1&cursor=${failed.id}`)
      .set("Authorization", authHeader)
      .expect(200);
    expect(page.body.syncRuns.map((r: SyncRun) => r.id)).toEqual([older.id]);
  });

  it("rejects an invalid filter", async () => {
    for (const query of [
      "status=pending",
      "limit=0",
      "limit=201",
      "type=partial",
    ]) {
      await request(app.getHttpServer())
        .get(`/v1/sync-runs?${query}`)
        .set("Authorization", authHeader)
        .expect(400);
    }
  });

  it("describes a run with the changes it made", async () => {
    const run = await record({
      changes: [
        {
          action: "added",
          eventId: "event-1",
          subject: "Planning",
          startTime: "2026-01-05T15:00:00.000Z",
        },
        {
          action: "deleted",
          eventId: "event-2",
          subject: "Old",
          startTime: null,
        },
      ],
    });

    const res = await request(app.getHttpServer())
      .get(`/v1/sync-run/${run.id}`)
      .set("Authorization", authHeader)
      .expect(200);
    expect(res.body.syncRun).toMatchObject({ id: run.id, calendarId });
    expect(res.body.syncRun.changes).toEqual([
      {
        action: "added",
        eventId: "event-1",
        subject: "Planning",
        startTime: "2026-01-05T15:00:00.000Z",
      },
      { action: "deleted", eventId: "event-2", subject: "Old" },
    ]);
  });

  it("answers 404 for an unknown run", async () => {
    await request(app.getHttpServer())
      .get("/v1/sync-run/no-such-run")
      .set("Authorization", authHeader)
      .expect(404);
  });

  it("aggregates runs per day and calendar", async () => {
    await record();
    await record({ status: "error", addedCount: 0, totalCount: 0 });

    const res = await request(app.getHttpServer())
      .get(`/v1/sync-runs/stats?calendarId=${calendarId}&days=7`)
      .set("Authorization", authHeader)
      .expect(200);
    const runs = res.body.syncRunStats.reduce(
      (sum: number, stat: { runCount: number }) => sum + stat.runCount,
      0,
    );
    expect(runs).toBe(2);
    expect(res.body.syncRunStats[0]).toMatchObject({ calendarId });
  });
});
