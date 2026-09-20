import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/AppModule";
import { configureApp } from "../../src/configureApp";
import { issueE2eAccessToken } from "./auth-fixtures";
import { seedCalendar } from "./calendar-fixtures";
import { afterEach, describe, expect, it } from "vitest";

// A never-real account label: SyncEngine's fire-and-forget attempt to
// resolve it fails fast on a missing local credential file (no network
// call), which is fine — these tests only assert on the HTTP response.
const FAKE_CALENDAR = {
  provider: "google" as const,
  accountLabel: "e2e-fake-account",
  calendarId: "cal-e2e",
  source: "e2e-source",
  enablePush: false,
};

describe("Calendars (e2e)", () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it("rejects requests with no access token", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    await request(app.getHttpServer()).get("/v1/calendars").expect(401);
  });

  it("ListCalendars returns the configured calendars with sync status", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    await seedCalendar(app, FAKE_CALENDAR);
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    const res = await request(app.getHttpServer())
      .get("/v1/calendars")
      .set("Authorization", authHeader)
      .expect(200);
    expect(res.body.calendars).toEqual([
      {
        ...FAKE_CALENDAR,
        synced: false,
        enabled: true,
        includedInBusy: true,
        syncing: expect.any(Boolean),
      },
    ]);
  });

  it("ListCalendars returns an empty list when nothing is configured", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    const res = await request(app.getHttpServer())
      .get("/v1/calendars")
      .set("Authorization", authHeader)
      .expect(200);
    expect(res.body.calendars).toEqual([]);
  });

  it("SyncCalendar 404s for an unconfigured calendar", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    await request(app.getHttpServer())
      .post("/v1/calendar/unknown/sync")
      .set("Authorization", authHeader)
      .expect(404);
  });

  it("SyncCalendar accepts a configured calendar", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    await seedCalendar(app, FAKE_CALENDAR);
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    await request(app.getHttpServer())
      .post(`/v1/calendar/${FAKE_CALENDAR.calendarId}/sync`)
      .set("Authorization", authHeader)
      .expect(202);
  });

  it("UpdateCalendar (enabled) 404s for an unconfigured calendar", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    await request(app.getHttpServer())
      .put("/v1/calendar/unknown")
      .set("Authorization", authHeader)
      .send({ calendar: { enabled: false } })
      .expect(404);
  });

  it("UpdateCalendar (enabled) persists the toggle and ListCalendars reflects it", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    await seedCalendar(app, FAKE_CALENDAR);
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    await request(app.getHttpServer())
      .put(`/v1/calendar/${FAKE_CALENDAR.calendarId}`)
      .set("Authorization", authHeader)
      .send({ calendar: { enabled: false } })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get("/v1/calendars")
      .set("Authorization", authHeader)
      .expect(200);
    expect(res.body.calendars).toEqual([
      {
        ...FAKE_CALENDAR,
        synced: false,
        enabled: false,
        includedInBusy: true,
        syncing: expect.any(Boolean),
      },
    ]);

    await request(app.getHttpServer())
      .put(`/v1/calendar/${FAKE_CALENDAR.calendarId}`)
      .set("Authorization", authHeader)
      .send({ calendar: { enabled: true } })
      .expect(200);

    const reenabled = await request(app.getHttpServer())
      .get("/v1/calendars")
      .set("Authorization", authHeader)
      .expect(200);
    expect(reenabled.body.calendars).toEqual([
      {
        ...FAKE_CALENDAR,
        synced: false,
        enabled: true,
        includedInBusy: true,
        syncing: expect.any(Boolean),
      },
    ]);
  });

  it("UpdateCalendar (includedInBusy) 404s for an unconfigured calendar", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    await request(app.getHttpServer())
      .put("/v1/calendar/unknown")
      .set("Authorization", authHeader)
      .send({ calendar: { includedInBusy: false } })
      .expect(404);
  });

  it("UpdateCalendar (includedInBusy) persists the toggle and ListCalendars reflects it", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    await seedCalendar(app, FAKE_CALENDAR);
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    await request(app.getHttpServer())
      .put(`/v1/calendar/${FAKE_CALENDAR.calendarId}`)
      .set("Authorization", authHeader)
      .send({ calendar: { includedInBusy: false } })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get("/v1/calendars")
      .set("Authorization", authHeader)
      .expect(200);
    expect(res.body.calendars).toEqual([
      {
        ...FAKE_CALENDAR,
        synced: false,
        enabled: true,
        includedInBusy: false,
        syncing: expect.any(Boolean),
      },
    ]);

    await request(app.getHttpServer())
      .put(`/v1/calendar/${FAKE_CALENDAR.calendarId}`)
      .set("Authorization", authHeader)
      .send({ calendar: { includedInBusy: true } })
      .expect(200);

    const reincluded = await request(app.getHttpServer())
      .get("/v1/calendars")
      .set("Authorization", authHeader)
      .expect(200);
    expect(reincluded.body.calendars).toEqual([
      {
        ...FAKE_CALENDAR,
        synced: false,
        enabled: true,
        includedInBusy: true,
        syncing: expect.any(Boolean),
      },
    ]);
  });
});
