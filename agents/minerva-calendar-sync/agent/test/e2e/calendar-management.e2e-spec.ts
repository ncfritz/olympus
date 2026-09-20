import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { saveGoogleCredential } from "../../src/providers/google/google-credential-store";
import { issueE2eAccessToken } from "./auth-fixtures";
import { seedCalendar } from "./calendar-fixtures";

// A never-real account label: SyncEngine's fire-and-forget attempt to
// resolve it fails fast on a missing local credential file (no network
// call), which is fine — these tests only assert on the HTTP response. It's
// the one "known, connected" account these tests can add more calendars
// against — POST /calendars now requires the account to actually be
// connected (CalendarAuthService.isConnected), so a credential file for it
// is seeded below too, not just a SyncedCalendarConfig row.
const KNOWN_CALENDAR = {
  provider: "google" as const,
  accountLabel: "e2e-known-account",
  calendarId: "cal-known",
  source: "e2e-known-source",
  enablePush: false,
};

describe("Calendar management (e2e)", () => {
  let app: INestApplication;
  let authHeader: string;

  beforeEach(async () => {
    saveGoogleCredential({
      accountLabel: KNOWN_CALENDAR.accountLabel,
      refreshToken: "e2e-refresh-token",
      scope: "https://www.googleapis.com/auth/calendar.readonly",
      obtainedAt: new Date().toISOString(),
    });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    await seedCalendar(app, KNOWN_CALENDAR);
    authHeader = `Bearer ${issueE2eAccessToken(app)}`;
  });

  afterEach(async () => {
    await app?.close();
  });

  it("POST /calendars 404s for an account that is not connected", async () => {
    await request(app.getHttpServer())
      .post("/calendars")
      .set("Authorization", authHeader)
      .send({
        provider: "google",
        accountLabel: "never-connected",
        calendarId: "cal-x",
        source: "X",
      })
      .expect(404);
  });

  it("POST /calendars 409s for a calendarId that is already synced", async () => {
    await request(app.getHttpServer())
      .post("/calendars")
      .set("Authorization", authHeader)
      .send({
        provider: KNOWN_CALENDAR.provider,
        accountLabel: KNOWN_CALENDAR.accountLabel,
        calendarId: KNOWN_CALENDAR.calendarId,
        source: "Dup",
      })
      .expect(409);
  });

  it("POST /calendars adds a calendar for a known, connected account, and GET /calendars includes it", async () => {
    const added = await request(app.getHttpServer())
      .post("/calendars")
      .set("Authorization", authHeader)
      .send({
        provider: KNOWN_CALENDAR.provider,
        accountLabel: KNOWN_CALENDAR.accountLabel,
        calendarId: "cal-added-1",
        source: "Added One",
      })
      .expect(201);

    expect(added.body).toEqual({
      provider: "google",
      accountLabel: KNOWN_CALENDAR.accountLabel,
      calendarId: "cal-added-1",
      source: "Added One",
      enablePush: false,
      synced: false,
      enabled: true,
      includedInBusy: true,
      syncing: expect.any(Boolean),
    });

    const list = await request(app.getHttpServer())
      .get("/calendars")
      .set("Authorization", authHeader)
      .expect(200);
    expect(list.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          calendarId: "cal-added-1",
          source: "Added One",
        }),
      ]),
    );
  });

  it("DELETE /calendars/:calendarId 404s for an unconfigured calendar", async () => {
    await request(app.getHttpServer())
      .delete("/calendars/never-added")
      .set("Authorization", authHeader)
      .expect(404);
  });

  it("DELETE /calendars/:calendarId removes a previously-added calendar", async () => {
    await request(app.getHttpServer())
      .post("/calendars")
      .set("Authorization", authHeader)
      .send({
        provider: KNOWN_CALENDAR.provider,
        accountLabel: KNOWN_CALENDAR.accountLabel,
        calendarId: "cal-added-2",
        source: "Added Two",
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete("/calendars/cal-added-2")
      .set("Authorization", authHeader)
      .expect(204);

    const list = await request(app.getHttpServer())
      .get("/calendars")
      .set("Authorization", authHeader)
      .expect(200);
    expect(list.body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ calendarId: "cal-added-2" }),
      ]),
    );
  });

  it("DELETE /calendars/:calendarId removes a calendar that was configured directly (not added through the API)", async () => {
    await request(app.getHttpServer())
      .delete(`/calendars/${KNOWN_CALENDAR.calendarId}`)
      .set("Authorization", authHeader)
      .expect(204);

    const list = await request(app.getHttpServer())
      .get("/calendars")
      .set("Authorization", authHeader)
      .expect(200);
    expect(list.body).toEqual([]);
  });
});
