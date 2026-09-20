import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { issueE2eAccessToken } from "./auth-fixtures";
import { seedCalendar } from "./calendar-fixtures";

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
    await app.init();

    await request(app.getHttpServer()).get("/calendars").expect(401);
  });

  it("GET /calendars returns the configured calendars with sync status", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    await seedCalendar(app, FAKE_CALENDAR);
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    const res = await request(app.getHttpServer())
      .get("/calendars")
      .set("Authorization", authHeader)
      .expect(200);
    expect(res.body).toEqual([
      {
        ...FAKE_CALENDAR,
        synced: false,
        enabled: true,
        includedInBusy: true,
        syncing: expect.any(Boolean),
      },
    ]);
  });

  it("GET /calendars returns an empty list when nothing is configured", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    const res = await request(app.getHttpServer())
      .get("/calendars")
      .set("Authorization", authHeader)
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it("POST /calendars/:calendarId/sync 404s for an unconfigured calendar", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    await request(app.getHttpServer())
      .post("/calendars/unknown/sync")
      .set("Authorization", authHeader)
      .expect(404);
  });

  it("POST /calendars/:calendarId/sync accepts a configured calendar", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    await seedCalendar(app, FAKE_CALENDAR);
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    await request(app.getHttpServer())
      .post(`/calendars/${FAKE_CALENDAR.calendarId}/sync`)
      .set("Authorization", authHeader)
      .expect(202);
  });

  it("PUT /calendars/:calendarId/enabled 404s for an unconfigured calendar", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    await request(app.getHttpServer())
      .put("/calendars/unknown/enabled")
      .set("Authorization", authHeader)
      .send({ enabled: false })
      .expect(404);
  });

  it("PUT /calendars/:calendarId/enabled persists the toggle and GET /calendars reflects it", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    await seedCalendar(app, FAKE_CALENDAR);
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    await request(app.getHttpServer())
      .put(`/calendars/${FAKE_CALENDAR.calendarId}/enabled`)
      .set("Authorization", authHeader)
      .send({ enabled: false })
      .expect(204);

    const res = await request(app.getHttpServer())
      .get("/calendars")
      .set("Authorization", authHeader)
      .expect(200);
    expect(res.body).toEqual([
      {
        ...FAKE_CALENDAR,
        synced: false,
        enabled: false,
        includedInBusy: true,
        syncing: expect.any(Boolean),
      },
    ]);

    await request(app.getHttpServer())
      .put(`/calendars/${FAKE_CALENDAR.calendarId}/enabled`)
      .set("Authorization", authHeader)
      .send({ enabled: true })
      .expect(204);

    const reenabled = await request(app.getHttpServer())
      .get("/calendars")
      .set("Authorization", authHeader)
      .expect(200);
    expect(reenabled.body).toEqual([
      {
        ...FAKE_CALENDAR,
        synced: false,
        enabled: true,
        includedInBusy: true,
        syncing: expect.any(Boolean),
      },
    ]);
  });

  it("PUT /calendars/:calendarId/included-in-busy 404s for an unconfigured calendar", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    await request(app.getHttpServer())
      .put("/calendars/unknown/included-in-busy")
      .set("Authorization", authHeader)
      .send({ includedInBusy: false })
      .expect(404);
  });

  it("PUT /calendars/:calendarId/included-in-busy persists the toggle and GET /calendars reflects it", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    await seedCalendar(app, FAKE_CALENDAR);
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    await request(app.getHttpServer())
      .put(`/calendars/${FAKE_CALENDAR.calendarId}/included-in-busy`)
      .set("Authorization", authHeader)
      .send({ includedInBusy: false })
      .expect(204);

    const res = await request(app.getHttpServer())
      .get("/calendars")
      .set("Authorization", authHeader)
      .expect(200);
    expect(res.body).toEqual([
      {
        ...FAKE_CALENDAR,
        synced: false,
        enabled: true,
        includedInBusy: false,
        syncing: expect.any(Boolean),
      },
    ]);

    await request(app.getHttpServer())
      .put(`/calendars/${FAKE_CALENDAR.calendarId}/included-in-busy`)
      .set("Authorization", authHeader)
      .send({ includedInBusy: true })
      .expect(204);

    const reincluded = await request(app.getHttpServer())
      .get("/calendars")
      .set("Authorization", authHeader)
      .expect(200);
    expect(reincluded.body).toEqual([
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
