import { ConflictException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MinervaCalendarAgentClient } from "../../../src/minerva/calendars/services/MinervaCalendarAgentClient";
import { signedInApp, USER } from "../../support/signedInApp";

const BASE = "/v1/minerva";
const ACCOUNT_ID = "ca000000-0000-4000-8000-000000000001";
const OTHER_ACCOUNT_ID = "ca000000-0000-4000-8000-000000000002";
const CALENDAR_ID = "neil@example.com";
const THEIR_CALENDAR_ID = "theirs@example.com";

const agent = {
  listCalendarAccounts: vi.fn(),
  startWebSignIn: vi.fn(),
  completeWebSignIn: vi.fn(),
  deleteCalendarAccount: vi.fn(),
  listAvailableCalendars: vi.fn(),
  listCalendars: vi.fn(),
  createCalendar: vi.fn(),
  updateCalendar: vi.fn(),
  deleteCalendar: vi.fn(),
  backfillCalendar: vi.fn(),
};

const accountRow = {
  id: ACCOUNT_ID,
  provider: "google",
  subject: "1098",
  email: "neil@example.com",
  userId: USER,
  verifiedTime: "2026-10-03T12:00:00Z",
  verificationMethod: "consent",
};

const agentCalendar = (overrides = {}) => ({
  provider: "google",
  accountLabel: "neil@example.com",
  calendarId: CALENDAR_ID,
  source: "neil",
  synced: true,
  enablePush: false,
  enabled: true,
  syncing: false,
  includedInBusy: true,
  lastSyncedAt: "2026-10-03T12:30:00Z",
  ...overrides,
});

/**
 * The synced calendars of the user's accounts over the real HTTP stack
 * (ADR 0028). The agent holds every user's calendars; each user sees and
 * changes only those of their own accounts.
 */
describe("Calendars API", () => {
  const ctx = signedInApp({
    overrides: [{ provide: MinervaCalendarAgentClient, useValue: agent }],
  });

  const owned = (rows: unknown[] = [accountRow]) =>
    ctx.t.graphql.on("ListCalendarAccounts", {
      minerva_calendar_accounts: rows,
    });
  const colors = (rows: { source: string; color: string }[] = []) =>
    ctx.t.graphql.on("ListCalendarColors", { minerva_calendar_colors: rows });
  const describeAccount = (rows: unknown[] = [accountRow]) =>
    ctx.t.graphql.on("DescribeCalendarAccount", {
      minerva_calendar_accounts: rows,
    });

  beforeEach(() => {
    for (const fn of Object.values(agent)) fn.mockReset();
    agent.listCalendars.mockResolvedValue([
      agentCalendar(),
      agentCalendar({
        accountLabel: "theirs@example.com",
        calendarId: THEIR_CALENDAR_ID,
        source: "theirs",
      }),
    ]);
  });

  describe("without an identity", () => {
    it.each([
      ["get", `${BASE}/calendars`],
      ["get", `${BASE}/calendar-account/${ACCOUNT_ID}/available`],
      ["post", `${BASE}/calendar-account/${ACCOUNT_ID}/calendars`],
      ["put", `${BASE}/calendar/${CALENDAR_ID}`],
      ["delete", `${BASE}/calendar/${CALENDAR_ID}`],
    ] as const)("%s %s answers 401 and asks no one", async (method, path) => {
      const res = await ctx.t.http()[method](path);
      expect(res.status).toBe(401);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
      expect(agent.listCalendars).not.toHaveBeenCalled();
    });
  });

  describe("ListCalendars", () => {
    it("lists only the calendars of the user's accounts", async () => {
      owned();
      colors();

      const res = await ctx.as(ctx.t.http().get(`${BASE}/calendars`));

      expect(res.status).toBe(200);
      expect(res.body.calendars).toEqual([
        {
          calendarId: CALENDAR_ID,
          accountId: ACCOUNT_ID,
          source: "neil",
          enabled: true,
          includedInBusy: true,
          synced: true,
          syncing: false,
          lastSyncedTime: "2026-10-03T12:30:00.000Z",
        },
      ]);
      expect(ctx.t.graphql.calls("ListCalendarAccounts")[0]?.variables).toEqual(
        { userId: USER },
      );
    });

    it("shows each calendar in the user's own color", async () => {
      owned();
      colors([
        { source: "neil", color: "#722ed1" },
        { source: "theirs", color: "#000000" },
      ]);

      const res = await ctx.as(ctx.t.http().get(`${BASE}/calendars`));

      expect(res.body.calendars).toEqual([
        expect.objectContaining({ source: "neil", color: "#722ed1" }),
      ]);
      expect(ctx.t.graphql.calls("ListCalendarColors")[0]?.variables).toEqual({
        userId: USER,
      });
    });

    it("lists nothing for a user with no accounts", async () => {
      owned([]);
      colors();

      const res = await ctx.as(ctx.t.http().get(`${BASE}/calendars`));

      expect(res.body.calendars).toEqual([]);
    });
  });

  describe("ListAvailableCalendars", () => {
    it("lists what the account's provider reports", async () => {
      describeAccount();
      agent.listAvailableCalendars.mockResolvedValue([
        { id: CALENDAR_ID, summary: "Neil", alreadySynced: true },
        {
          id: "team@group.calendar.google.com",
          summary: "Team",
          alreadySynced: false,
        },
      ]);

      const res = await ctx.as(
        ctx.t.http().get(`${BASE}/calendar-account/${ACCOUNT_ID}/available`),
      );

      expect(res.status).toBe(200);
      expect(res.body.availableCalendars).toEqual([
        { calendarId: CALENDAR_ID, name: "Neil", synced: true },
        {
          calendarId: "team@group.calendar.google.com",
          name: "Team",
          synced: false,
        },
      ]);
      expect(agent.listAvailableCalendars).toHaveBeenCalledWith(
        "google",
        "neil@example.com",
      );
    });

    it("does not find another user's account", async () => {
      describeAccount([]);

      const res = await ctx.as(
        ctx.t
          .http()
          .get(`${BASE}/calendar-account/${OTHER_ACCOUNT_ID}/available`),
      );

      expect(res.status).toBe(404);
      expect(agent.listAvailableCalendars).not.toHaveBeenCalled();
    });
  });

  describe("AddCalendar", () => {
    const add = (calendar: unknown, accountId = ACCOUNT_ID) =>
      ctx.as(
        ctx.t
          .http()
          .post(`${BASE}/calendar-account/${accountId}/calendars`)
          .send({ calendar }),
      );

    it("starts syncing a calendar of the user's account", async () => {
      describeAccount();
      agent.createCalendar.mockResolvedValue(
        agentCalendar({
          calendarId: "team@group",
          source: "team",
          synced: false,
        }),
      );

      const res = await add({ calendarId: " team@group ", source: " team " });

      expect(res.status).toBe(201);
      expect(res.headers.location).toBeUndefined();
      expect(res.body.calendar).toMatchObject({
        calendarId: "team@group",
        accountId: ACCOUNT_ID,
        source: "team",
      });
      expect(agent.createCalendar).toHaveBeenCalledWith({
        provider: "google",
        accountLabel: "neil@example.com",
        calendarId: "team@group",
        source: "team",
      });
    });

    it.each([
      ["no calendar", { source: "team" }],
      ["no source", { calendarId: "team@group" }],
      [
        "a source too long",
        { calendarId: "team@group", source: "x".repeat(65) },
      ],
      ["Google's primary alias", { calendarId: "primary", source: "neil" }],
    ])("refuses %s", async (_, calendar) => {
      const res = await add(calendar);

      expect(res.status).toBe(400);
      expect(agent.createCalendar).not.toHaveBeenCalled();
    });

    it("answers 409 for a source another calendar has", async () => {
      describeAccount();
      agent.createCalendar.mockRejectedValue(
        new ConflictException("source neil is taken"),
      );

      const res = await add({ calendarId: "team@group", source: "neil" });

      expect(res.status).toBe(409);
    });

    it("does not find another user's account", async () => {
      describeAccount([]);

      const res = await add(
        { calendarId: "team@group", source: "team" },
        OTHER_ACCOUNT_ID,
      );

      expect(res.status).toBe(404);
      expect(agent.createCalendar).not.toHaveBeenCalled();
    });
  });

  describe("UpdateCalendar", () => {
    const update = (calendar: unknown, calendarId = CALENDAR_ID) =>
      ctx.as(
        ctx.t.http().put(`${BASE}/calendar/${calendarId}`).send({ calendar }),
      );

    it("pauses one of the user's calendars", async () => {
      owned();
      colors();
      agent.updateCalendar.mockResolvedValue(agentCalendar({ enabled: false }));

      const res = await update({ enabled: false, source: "renamed" });

      expect(res.status).toBe(200);
      expect(res.body.calendar.enabled).toBe(false);
      // Only the changes the operation allows go to the agent.
      expect(agent.updateCalendar).toHaveBeenCalledWith(CALENDAR_ID, {
        enabled: false,
      });
    });

    it("sets the user's color without asking the agent to change anything", async () => {
      owned();
      ctx.t.graphql.on("SetCalendarColor", {
        insert_minerva_calendar_colors_one: { source: "neil" },
      });

      const res = await update({ color: "#FA8C16" });

      expect(res.status).toBe(200);
      expect(res.body.calendar).toMatchObject({
        calendarId: CALENDAR_ID,
        color: "#fa8c16",
      });
      expect(agent.updateCalendar).not.toHaveBeenCalled();
      const set = ctx.t.graphql.calls("SetCalendarColor")[0];
      expect(set?.variables).toEqual({
        color: { userId: USER, source: "neil", color: "#fa8c16" },
      });
      expect(set?.document).toContain("update_columns: [color]");
    });

    it("sets a color and a setting together", async () => {
      owned();
      ctx.t.graphql.on("SetCalendarColor", {
        insert_minerva_calendar_colors_one: { source: "neil" },
      });
      agent.updateCalendar.mockResolvedValue(
        agentCalendar({ includedInBusy: false }),
      );

      const res = await update({ includedInBusy: false, color: "#13c2c2" });

      expect(res.body.calendar).toMatchObject({
        includedInBusy: false,
        color: "#13c2c2",
      });
      expect(agent.updateCalendar).toHaveBeenCalledWith(CALENDAR_ID, {
        includedInBusy: false,
      });
    });

    it.each(["blue", "#fff", "#12345g", 7])(
      "refuses the color %j",
      async (color) => {
        const res = await update({ color });

        expect(res.status).toBe(400);
        expect(ctx.t.graphql.request).not.toHaveBeenCalled();
      },
    );

    it("does not color another user's calendar", async () => {
      owned();

      const res = await update({ color: "#13c2c2" }, THEIR_CALENDAR_ID);

      expect(res.status).toBe(404);
      expect(ctx.t.graphql.calls("SetCalendarColor")).toHaveLength(0);
    });

    it("answers 304 when nothing is to change", async () => {
      const res = await update({});

      expect(res.status).toBe(304);
      expect(agent.updateCalendar).not.toHaveBeenCalled();
    });

    it("refuses a change that is not true or false", async () => {
      const res = await update({ includedInBusy: "yes" });

      expect(res.status).toBe(400);
      expect(agent.updateCalendar).not.toHaveBeenCalled();
    });

    it("does not find another user's calendar", async () => {
      owned();

      const res = await update({ enabled: false }, THEIR_CALENDAR_ID);

      expect(res.status).toBe(404);
      expect(agent.updateCalendar).not.toHaveBeenCalled();
    });
  });

  describe("RemoveCalendar", () => {
    it("stops syncing one of the user's calendars", async () => {
      owned();
      agent.deleteCalendar.mockResolvedValue(undefined);

      const res = await ctx.as(
        ctx.t.http().delete(`${BASE}/calendar/${CALENDAR_ID}`),
      );

      expect(res.status).toBe(204);
      expect(agent.deleteCalendar).toHaveBeenCalledWith(CALENDAR_ID);
    });

    it("does not find another user's calendar", async () => {
      owned();

      const res = await ctx.as(
        ctx.t.http().delete(`${BASE}/calendar/${THEIR_CALENDAR_ID}`),
      );

      expect(res.status).toBe(404);
      expect(agent.deleteCalendar).not.toHaveBeenCalled();
    });
  });
});
