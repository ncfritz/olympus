import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/AppModule";
import { configureApp } from "../../src/configureApp";
import { CanonicalCalendarEvent } from "../../src/domain/canonicalEvent";
import { EVENT_STORE, EventStore } from "../../src/store/eventStore";
import { issueE2eAccessToken } from "./auth-fixtures";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

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
    type: "appointment",
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

describe("Events (e2e)", () => {
  let app: INestApplication;
  let store: EventStore;
  let authHeader: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    store = app.get(EVENT_STORE);
    authHeader = `Bearer ${issueE2eAccessToken()}`;
  });

  afterEach(async () => {
    await app.close();
  });

  it("rejects requests with no access token", () => {
    return request(app.getHttpServer()).get("/v1/events").expect(401);
  });

  it("ListEvents lists stored events and supports filtering", async () => {
    await store.upsertEvent(fixtureEvent({ uid: "a" }));
    await store.upsertEvent(fixtureEvent({ uid: "b", cancelled: true }));

    const all = await request(app.getHttpServer())
      .get("/v1/events")
      .set("Authorization", authHeader)
      .expect(200);
    expect(all.body.events).toHaveLength(2);

    const cancelledOnly = await request(app.getHttpServer())
      .get("/v1/events?cancelled=true")
      .set("Authorization", authHeader)
      .expect(200);
    expect(
      cancelledOnly.body.events.map((e: { uid: string }) => e.uid),
    ).toEqual(["b"]);
  });

  it("DescribeEvent returns the matching event", async () => {
    await store.upsertEvent(fixtureEvent({ uid: "a", subject: "Find me" }));

    const res = await request(app.getHttpServer())
      .get("/v1/event/test-source:a")
      .set("Authorization", authHeader)
      .expect(200);
    expect(res.body.event.subject).toBe("Find me");
  });

  it("DescribeEvent 404s for an unknown event", () => {
    return request(app.getHttpServer())
      .get("/v1/event/nope:nope")
      .set("Authorization", authHeader)
      .expect(404);
  });

  it("rejects a non-numeric limit", () => {
    return request(app.getHttpServer())
      .get("/v1/events?limit=abc")
      .set("Authorization", authHeader)
      .expect(400);
  });

  it("rejects an unknown query parameter", () => {
    return request(app.getHttpServer())
      .get("/v1/events?bogus=1")
      .set("Authorization", authHeader)
      .expect(400);
  });
});
