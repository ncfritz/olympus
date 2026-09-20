import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/AppModule";
import { configureApp } from "../../src/configureApp";
import { issueE2eAccessToken } from "./auth-fixtures";
import { seedCalendar } from "./calendar-fixtures";
import { afterEach, describe, expect, it } from "vitest";

// A never-real account label: GET /calendar-accounts resolves it via a
// local-file lookup (tryLoadGoogleCredential), which just reports
// "not_connected" for a missing file — no network call, so it's safe here.
// Actually starting a reauth flow is left to the unit tests (it opens a real
// loopback listener, which would leak past the test).
const FAKE_CALENDAR = {
  provider: "google" as const,
  accountLabel: "e2e-fake-account",
  calendarId: "cal-e2e",
  source: "e2e-source",
  enablePush: false,
};

// Same rationale as FAKE_CALENDAR above, for the Microsoft path: resolving
// status via tryLoadMicrosoftCredential is just a local-file lookup.
const FAKE_MICROSOFT_CALENDAR = {
  provider: "microsoft" as const,
  accountLabel: "e2e-fake-o365-account",
  calendarId: "cal-e2e-o365",
  source: "e2e-o365-source",
  enablePush: false,
};

describe("Calendar accounts (e2e)", () => {
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

    await request(app.getHttpServer()).get("/calendar-accounts").expect(401);
  });

  it("GET /calendar-accounts returns an empty list when nothing is configured", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    const res = await request(app.getHttpServer())
      .get("/calendar-accounts")
      .set("Authorization", authHeader)
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it("GET /calendar-accounts reports not_connected for a configured account with no stored credential", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    await seedCalendar(app, FAKE_CALENDAR);
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    const res = await request(app.getHttpServer())
      .get("/calendar-accounts")
      .set("Authorization", authHeader)
      .expect(200);
    expect(res.body).toEqual([
      {
        accountLabel: FAKE_CALENDAR.accountLabel,
        provider: "google",
        sources: [FAKE_CALENDAR.source],
        status: "not_connected",
      },
    ]);
  });

  it("GET /calendar-accounts reports not_connected for a configured Microsoft account with no stored credential", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    await seedCalendar(app, FAKE_MICROSOFT_CALENDAR);
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    const res = await request(app.getHttpServer())
      .get("/calendar-accounts")
      .set("Authorization", authHeader)
      .expect(200);
    expect(res.body).toEqual([
      {
        accountLabel: FAKE_MICROSOFT_CALENDAR.accountLabel,
        provider: "microsoft",
        sources: [FAKE_MICROSOFT_CALENDAR.source],
        status: "not_connected",
      },
    ]);
  });

  it("GET /calendar-accounts/:accountLabel/available-calendars 404s when the Microsoft account has no stored credential", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    await seedCalendar(app, FAKE_MICROSOFT_CALENDAR);
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    await request(app.getHttpServer())
      .get(
        `/calendar-accounts/${FAKE_MICROSOFT_CALENDAR.accountLabel}/available-calendars`,
      )
      .set("Authorization", authHeader)
      .expect(404);
  });

  it("GET /calendar-accounts keeps a google and a microsoft account distinct even when they share the exact same accountLabel", async () => {
    const sharedLabel = "e2e-shared-label@example.com";
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    await seedCalendar(app, { ...FAKE_CALENDAR, accountLabel: sharedLabel });
    await seedCalendar(app, {
      ...FAKE_MICROSOFT_CALENDAR,
      accountLabel: sharedLabel,
    });
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    const res = await request(app.getHttpServer())
      .get("/calendar-accounts")
      .set("Authorization", authHeader)
      .expect(200);
    expect(res.body).toEqual(
      expect.arrayContaining([
        {
          accountLabel: sharedLabel,
          provider: "google",
          sources: [FAKE_CALENDAR.source],
          status: "not_connected",
        },
        {
          accountLabel: sharedLabel,
          provider: "microsoft",
          sources: [FAKE_MICROSOFT_CALENDAR.source],
          status: "not_connected",
        },
      ]),
    );
    expect(res.body).toHaveLength(2);
  });

  it("GET /calendar-accounts/:accountLabel/available-calendars disambiguates via ?provider= when the same accountLabel collides across providers", async () => {
    const sharedLabel = "e2e-shared-label@example.com";
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    await seedCalendar(app, { ...FAKE_CALENDAR, accountLabel: sharedLabel });
    await seedCalendar(app, {
      ...FAKE_MICROSOFT_CALENDAR,
      accountLabel: sharedLabel,
    });
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    // Neither has a stored credential, so both 404 as "hasn't completed
    // sign-in yet" — the point here is that ?provider= is what's resolving
    // *which* account (not that either succeeds), so a bogus accountLabel
    // with no matching provider at all must still 404 distinctly.
    await request(app.getHttpServer())
      .get(`/calendar-accounts/${sharedLabel}/available-calendars`)
      .query({ provider: "google" })
      .set("Authorization", authHeader)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/calendar-accounts/${sharedLabel}/available-calendars`)
      .query({ provider: "microsoft" })
      .set("Authorization", authHeader)
      .expect(404);
  });

  it("POST /calendar-accounts/:accountLabel/reauth 404s for an unconfigured account", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    await request(app.getHttpServer())
      .post("/calendar-accounts/unknown/reauth")
      .set("Authorization", authHeader)
      .expect(404);
  });

  it("GET /calendar-accounts/:accountLabel/available-calendars 404s for an unconfigured account", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    await request(app.getHttpServer())
      .get("/calendar-accounts/unknown/available-calendars")
      .set("Authorization", authHeader)
      .expect(404);
  });

  it("GET /calendar-accounts/:accountLabel/available-calendars 404s when the account has no stored credential", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    await seedCalendar(app, FAKE_CALENDAR);
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    await request(app.getHttpServer())
      .get(
        `/calendar-accounts/${FAKE_CALENDAR.accountLabel}/available-calendars`,
      )
      .set("Authorization", authHeader)
      .expect(404);
  });

  it("GET /calendar-accounts/new/:transactionId 404s for an unknown transaction", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    await request(app.getHttpServer())
      .get("/calendar-accounts/new/unknown-transaction")
      .set("Authorization", authHeader)
      .expect(404);
  });

  // Starting a real "new account" flow is left to the unit tests — it opens
  // a real loopback listener, which would leak past the test (same reason
  // reauth's happy path isn't exercised here either).
  it("POST /calendar-accounts/new rejects an unsupported provider", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    await request(app.getHttpServer())
      .post("/calendar-accounts/new")
      .set("Authorization", authHeader)
      .send({ provider: "office365" })
      .expect(400);
  });
});
