import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../../src/AppModule";
import { configureApp } from "../../src/configureApp";
import { issueE2eAccessToken } from "./auth-fixtures";
import { olympus } from "./olympus-fake";

/**
 * The console's availability, asked of the Olympus API through the agent
 * as the signed-in user (ADR 0029).
 */
describe("Forwarding to Olympus (e2e)", () => {
  let app: INestApplication;
  let token: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    token = issueE2eAccessToken();
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it("asks Olympus as the user, in the user's time zone, and answers what it answers", async () => {
    const availability = {
      availability: { slots: [], meetings: [], blocks: [] },
    };
    olympus.answer("GET /v1/minerva/availability", {
      status: 200,
      body: availability,
    });

    const res = await http()
      .get("/olympus/v1/minerva/availability")
      .query({ start: "2026-10-05T00:00:00Z", end: "2026-10-06T00:00:00Z" })
      .set("Authorization", `Bearer ${token}`)
      .set("x-ncfritz-tz", "America/Los_Angeles")
      .expect(200);

    expect(res.body).toEqual(availability);
    const [asked] = olympus.requests("GET /v1/minerva/availability");
    expect(asked?.url).toBe(
      "/v1/minerva/availability?start=2026-10-05T00%3A00%3A00Z&end=2026-10-06T00%3A00%3A00Z",
    );
    expect(asked?.headers.authorization).toBe(`Bearer ${token}`);
    expect(asked?.headers["x-ncfritz-tz"]).toBe("America/Los_Angeles");
    expect(asked?.headers["x-olympus-client"]).toBe("minerva-calendar-console");
  });

  it("passes a change on as JSON", async () => {
    olympus.answer("PUT /v1/minerva/meeting/work:abc/availability", {
      status: 200,
      body: { meeting: { meetingId: "work:abc", status: "free" } },
    });

    await http()
      .put("/olympus/v1/minerva/meeting/work:abc/availability")
      .set("Authorization", `Bearer ${token}`)
      .send({ availability: { status: "free" } })
      .expect(200);

    const [asked] = olympus.requests(
      "PUT /v1/minerva/meeting/work:abc/availability",
    );
    expect(JSON.parse(asked!.body)).toEqual({
      availability: { status: "free" },
    });
    expect(asked?.headers["content-type"]).toBe("application/json");
  });

  it("answers Olympus's refusals and empty answers as they are", async () => {
    olympus.answer("POST /v1/minerva/availability-blocks", {
      status: 400,
      body: {
        statusCode: 400,
        message: ["status must be one of none, free, interruptable, busy"],
      },
    });
    olympus.answer("DELETE /v1/minerva/availability-block/b-1", {
      status: 204,
    });

    const refused = await http()
      .post("/olympus/v1/minerva/availability-blocks")
      .set("Authorization", `Bearer ${token}`)
      .send({ block: { status: "dnd" } })
      .expect(400);
    expect(refused.body.message).toEqual([
      "status must be one of none, free, interruptable, busy",
    ]);

    await http()
      .delete("/olympus/v1/minerva/availability-block/b-1")
      .set("Authorization", `Bearer ${token}`)
      .expect(204);
    expect(
      olympus.requests("DELETE /v1/minerva/availability-block/b-1")[0]?.body,
    ).toBe("");
  });

  it.each([
    ["GET", "/olympus/v1/minerva/meetings"],
    ["DELETE", "/olympus/v1/minerva/availability"],
    ["GET", "/olympus/v1/minerva/availability-block/b-1/../../meetings"],
    ["GET", "/olympus/v1/minerva/availability-block/%2e%2e/x"],
  ])("forwards nothing else: %s %s", async (method, path) => {
    await http()
      [method.toLowerCase() as "get" | "delete"](path)
      .set("Authorization", `Bearer ${token}`)
      .expect(404);
    expect(
      olympus.received.filter((r) => r.url.startsWith("/v1/")),
    ).toHaveLength(0);
  });

  it("forwards nothing without a signed-in admin", async () => {
    await http().get("/olympus/v1/minerva/availability").expect(401);
    await http()
      .get("/olympus/v1/minerva/availability")
      .set("Authorization", `Bearer ${issueE2eAccessToken({ roles: [] })}`)
      .expect(403);
    expect(
      olympus.received.filter((r) => r.url.startsWith("/v1/")),
    ).toHaveLength(0);
  });
});
