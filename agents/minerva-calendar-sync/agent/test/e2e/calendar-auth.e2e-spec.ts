import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/AppModule";
import { configureApp } from "../../src/configureApp";
import { issueE2eAccessToken } from "./auth-fixtures";
import { seedCalendar } from "./calendar-fixtures";
import { afterEach, describe, expect, it } from "vitest";

// A never-real account label: ListCalendarAccounts resolves it via a
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

    await request(app.getHttpServer()).get("/v1/calendar-accounts").expect(401);
  });

  it("ListCalendarAccounts returns an empty list when nothing is configured", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    const res = await request(app.getHttpServer())
      .get("/v1/calendar-accounts")
      .set("Authorization", authHeader)
      .expect(200);
    expect(res.body.calendarAccounts).toEqual([]);
  });

  it("ListCalendarAccounts reports not_connected for a configured account with no stored credential", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    await seedCalendar(app, FAKE_CALENDAR);
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    const res = await request(app.getHttpServer())
      .get("/v1/calendar-accounts")
      .set("Authorization", authHeader)
      .expect(200);
    expect(res.body.calendarAccounts).toEqual([
      {
        accountLabel: FAKE_CALENDAR.accountLabel,
        provider: "google",
        sources: [FAKE_CALENDAR.source],
        status: "not_connected",
      },
    ]);
  });

  it("ListCalendarAccounts reports not_connected for a configured Microsoft account with no stored credential", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    await seedCalendar(app, FAKE_MICROSOFT_CALENDAR);
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    const res = await request(app.getHttpServer())
      .get("/v1/calendar-accounts")
      .set("Authorization", authHeader)
      .expect(200);
    expect(res.body.calendarAccounts).toEqual([
      {
        accountLabel: FAKE_MICROSOFT_CALENDAR.accountLabel,
        provider: "microsoft",
        sources: [FAKE_MICROSOFT_CALENDAR.source],
        status: "not_connected",
      },
    ]);
  });

  it("ListAvailableCalendars 404s when the Microsoft account has no stored credential", async () => {
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
        `/v1/calendar-account/${FAKE_MICROSOFT_CALENDAR.accountLabel}/calendars`,
      )
      .set("Authorization", authHeader)
      .expect(404);
  });

  it("ListCalendarAccounts keeps a google and a microsoft account distinct even when they share the exact same accountLabel", async () => {
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
      .get("/v1/calendar-accounts")
      .set("Authorization", authHeader)
      .expect(200);
    expect(res.body.calendarAccounts).toEqual(
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
    expect(res.body.calendarAccounts).toHaveLength(2);
  });

  it("ListAvailableCalendars disambiguates via ?provider= when the same accountLabel collides across providers", async () => {
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
      .get(`/v1/calendar-account/${sharedLabel}/calendars`)
      .query({ provider: "google" })
      .set("Authorization", authHeader)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/v1/calendar-account/${sharedLabel}/calendars`)
      .query({ provider: "microsoft" })
      .set("Authorization", authHeader)
      .expect(404);
  });

  it("ReauthorizeCalendarAccount 404s for an unconfigured account", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    await request(app.getHttpServer())
      .post("/v1/calendar-account/unknown/reauthorize")
      .set("Authorization", authHeader)
      .expect(404);
  });

  it("ListAvailableCalendars 404s for an unconfigured account", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    await request(app.getHttpServer())
      .get("/v1/calendar-account/unknown/calendars")
      .set("Authorization", authHeader)
      .expect(404);
  });

  it("ListAvailableCalendars 404s when the account has no stored credential", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    await seedCalendar(app, FAKE_CALENDAR);
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    await request(app.getHttpServer())
      .get(`/v1/calendar-account/${FAKE_CALENDAR.accountLabel}/calendars`)
      .set("Authorization", authHeader)
      .expect(404);
  });

  it("DescribeCalendarAccountAuthorization 404s for an unknown transaction", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    await request(app.getHttpServer())
      .get("/v1/calendar-account-authorization/unknown-transaction")
      .set("Authorization", authHeader)
      .expect(404);
  });

  // Starting a real "new account" flow is left to the unit tests — it opens
  // a real loopback listener, which would leak past the test (same reason
  // reauth's happy path isn't exercised here either).
  it("CreateCalendarAccountAuthorization rejects an unsupported provider", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    await request(app.getHttpServer())
      .post("/v1/calendar-account-authorizations")
      .set("Authorization", authHeader)
      .send({ calendarAccountAuthorization: { provider: "office365" } })
      .expect(400);
  });
});
