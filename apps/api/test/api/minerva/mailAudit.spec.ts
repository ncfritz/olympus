import { describe, expect, it } from "vitest";
import {
  MAIL_AUDIT_HIGH_CONFIDENCE,
  MAIL_AUDIT_TOP,
} from "../../../src/minerva/mail/services/MailAuditService";
import { signedInApp, USER } from "../../support/signedInApp";

const RUNS = "/v1/minerva/mail/audit/runs";
const AUDIT = "/v1/minerva/mail/audit";
const CHANGES = "/v1/minerva/mail/audit/changes";

const run = {
  id: "8d4d0000-0000-4000-8000-000000000001",
  accountId: "7b2b0000-0000-4000-8000-000000000001",
  startedTime: "2026-10-05T23:00:00+00:00",
  finishedTime: "2026-10-05T23:00:04+00:00",
  messagesExamined: 255690,
  sendersExamined: 7957,
  consistentSenders: 7098,
};

const audit = (overrides: Record<string, unknown> = {}) => ({
  minerva_mail_audit_summary: [
    {
      startedTime: run.startedTime,
      finishedTime: run.finishedTime,
      messagesExamined: "255690",
      consistentSenders: "7098",
      changes: "38778",
      additions: 22282,
      removals: 16496,
      highConfidence: "31849",
      messagesAffected: 30000,
      merges: 1,
      threads: "9131",
    },
  ],
  minerva_mail_audit_labels: [
    {
      name: "Accounts/Advertisements",
      messages: "20",
      lastReceivedTime: "2026-01-01T00:00:00+00:00",
      proposedIn: 0,
      proposedOut: "2",
      highConfidence: 2,
      mergeCandidate: true,
    },
    {
      name: "Unused",
      messages: 0,
      lastReceivedTime: null,
      proposedIn: 0,
      proposedOut: 0,
      highConfidence: 0,
      mergeCandidate: false,
    },
  ],
  minerva_mail_audit_merges: [
    {
      reason: "same_leaf",
      sharedSenders: 352,
      fromSenders: 377,
      senderOverlap: "0.934",
      fromMessages: 2195,
      intoMessages: 10107,
      fromLastReceivedTime: "2019-05-01T00:00:00+00:00",
      intoLastReceivedTime: null,
      fromLabel: { name: "Advertisements" },
      intoLabel: { name: "Accounts/Advertisements" },
    },
  ],
  minerva_mail_audit_threads: [
    {
      threadId: "1a0fab8f293aa5b5",
      messages: 3,
      labelSets: 2,
      lastReceivedTime: "2026-09-01T00:00:00+00:00",
    },
  ],
  minerva_mail_star_labels: [
    { name: "Bills/Power", messages: "30", starred: 4 },
  ],
  minerva_mail_star_senders: [
    { address: "bill@power.example", messages: 30, starred: "4" },
  ],
  minerva_mail_star_ages: [
    { age: "month", starred: 1 },
    { age: "year", starred: "0" },
    { age: "older", starred: 3 },
  ],
  minerva_mail_star_mixed: [
    {
      address: "bill@water.example",
      subjectPattern: "your bill #",
      messages: "5",
      starred: 2,
      lastReceivedTime: "2026-09-01T00:00:00+00:00",
    },
  ],
  ...overrides,
});

const change = (overrides: Record<string, unknown> = {}) => ({
  action: "add",
  rule: "sender",
  confidence: "0.900",
  senderMessages: 30,
  senderLabelMessages: 27,
  label: { name: "Bills/Power" },
  message: {
    gmailId: "1a0fab8f293aa5b5",
    threadId: "1a0fab8f293aa5b5",
    receivedTime: "2026-09-01T00:00:00+00:00",
    fromAddress: "bill@power.example",
    fromName: "Power Co",
    subject: "Your bill",
    messageLabels: [
      { label: { name: "Shopping", type: "user" } },
      { label: { name: "CATEGORY_UPDATES", type: "system" } },
      { label: { name: "Bills", type: "user" } },
    ],
  },
  ...overrides,
});

/**
 * The mail audit (docs/plans/email-management phase 2): RunMailAudit,
 * GetMailAudit and ListMailAuditChanges, each over the caller's own mail.
 */
describe("Mail audit API", () => {
  const ctx = signedInApp();
  const t = () => ctx.t;

  it.each([
    ["post", RUNS],
    ["get", AUDIT],
    ["get", CHANGES],
  ] as const)(
    "%s %s answers 401 without an identity and asks Hasura nothing",
    async (method, path) => {
      const res = await t().http()[method](path);
      expect(res.status).toBe(401);
      expect(t().graphql.request).not.toHaveBeenCalled();
    },
  );

  describe("POST /v1/minerva/mail/audit/runs (RunMailAudit)", () => {
    it("audits the caller's accounts and answers the runs", async () => {
      t().graphql.on("RunMailAudit", { minerva_mail_run_audit: [run] });

      const res = await ctx.as(t().http().post(RUNS));

      expect(res.status).toBe(200);
      expect(res.body.runs).toHaveLength(1);
      expect(res.body.runs[0]).toMatchObject({
        id: run.id,
        accountId: run.accountId,
        messagesExamined: 255690,
        consistentSenders: 7098,
      });
      expect(t().graphql.calls("RunMailAudit")[0].variables).toEqual({
        userId: USER,
      });
    });
  });

  describe("GET /v1/minerva/mail/audit (GetMailAudit)", () => {
    it("answers the latest run's findings and the stars", async () => {
      t().graphql.on("GetMailAudit", audit());

      const res = await ctx.as(t().http().get(AUDIT));

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        highConfidence: MAIL_AUDIT_HIGH_CONFIDENCE,
        summary: {
          changes: 38778,
          additions: 22282,
          removals: 16496,
          highConfidence: 31849,
          merges: 1,
          threads: 9131,
        },
        labels: [
          {
            name: "Accounts/Advertisements",
            messages: 20,
            proposedOut: 2,
            mergeCandidate: true,
          },
          { name: "Unused", messages: 0, mergeCandidate: false },
        ],
        merges: [
          {
            fromLabel: "Advertisements",
            intoLabel: "Accounts/Advertisements",
            reason: "same_leaf",
            senderOverlap: 0.934,
            fromMessages: 2195,
          },
        ],
        threads: [{ threadId: "1a0fab8f293aa5b5", messages: 3, labelSets: 2 }],
        stars: {
          labels: [{ name: "Bills/Power", messages: 30, starred: 4 }],
          senders: [{ address: "bill@power.example", starred: 4 }],
          ages: [
            { age: "month", starred: 1 },
            { age: "year", starred: 0 },
            { age: "older", starred: 3 },
          ],
          mixed: [{ subjectPattern: "your bill #", messages: 5, starred: 2 }],
        },
      });
      expect(res.body.labels[1]).not.toHaveProperty("lastReceivedTime");
      expect(res.body.merges[0]).not.toHaveProperty("intoLastReceivedTime");
      expect(t().graphql.calls("GetMailAudit")[0].variables).toEqual({
        userId: USER,
        high: MAIL_AUDIT_HIGH_CONFIDENCE,
        threads: MAIL_AUDIT_TOP.threads,
        starLabels: MAIL_AUDIT_TOP.starLabels,
        starSenders: MAIL_AUDIT_TOP.starSenders,
        starMixed: MAIL_AUDIT_TOP.starMixed,
      });
    });

    it("answers no summary before the first run", async () => {
      t().graphql.on(
        "GetMailAudit",
        audit({
          minerva_mail_audit_summary: [],
          minerva_mail_audit_merges: [],
          minerva_mail_audit_threads: [],
        }),
      );

      const res = await ctx.as(t().http().get(AUDIT));

      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty("summary");
      expect(res.body.labels).toHaveLength(2);
    });
  });

  describe("GET /v1/minerva/mail/audit/changes (ListMailAuditChanges)", () => {
    const changes = (rows = [change()], count = rows.length) => ({
      minerva_mail_audit_changes: rows,
      minerva_mail_audit_changes_aggregate: { aggregate: { count } },
    });

    it("pages the caller's changes, most confident first, with the message's user labels", async () => {
      t().graphql.on("ListMailAuditChanges", changes([change()], 38778));

      const res = await ctx.as(t().http().get(CHANGES));

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(38778);
      expect(res.body.changes[0]).toMatchObject({
        label: "Bills/Power",
        action: "add",
        rule: "sender",
        confidence: 0.9,
        senderMessages: 30,
        senderLabelMessages: 27,
        message: {
          gmailId: "1a0fab8f293aa5b5",
          fromAddress: "bill@power.example",
          fromName: "Power Co",
          subject: "Your bill",
          labels: ["Bills", "Shopping"],
        },
      });
      expect(res.body.changes[0].message).not.toHaveProperty("snippet");
      expect(t().graphql.calls("ListMailAuditChanges")[0].variables).toEqual({
        where: { run: { account: { userId: { _eq: USER } } } },
        orderBy: [
          { confidence: "desc" },
          { message: { receivedTime: "desc" } },
          { messageId: "asc" },
        ],
        limit: 50,
        offset: 0,
      });
    });

    it("filters by label, action and confidence, newest first, from a later page", async () => {
      t().graphql.on("ListMailAuditChanges", changes([]));

      const res = await ctx.as(
        t().http().get(CHANGES).query({
          label: "Bills/Power",
          action: "remove",
          minConfidence: "0.95",
          sortBy: "receivedTime",
          sort: "asc",
          pageSize: "20",
          startPage: "3",
        }),
      );

      expect(res.status).toBe(200);
      expect(t().graphql.calls("ListMailAuditChanges")[0].variables).toEqual({
        where: {
          run: { account: { userId: { _eq: USER } } },
          label: { name: { _eq: "Bills/Power" } },
          action: { _eq: "remove" },
          confidence: { _gte: 0.95 },
        },
        orderBy: [
          { message: { receivedTime: "asc" } },
          { confidence: "desc" },
          { messageId: "asc" },
        ],
        limit: 20,
        offset: 60,
      });
    });

    it.each([
      ["an unknown action", { action: "move" }],
      ["a confidence that is not a number", { minConfidence: "high" }],
      ["a confidence above 1", { minConfidence: "1.5" }],
      ["a negative confidence", { minConfidence: "-0.1" }],
      ["an unknown sort field", { sortBy: "subject" }],
      ["an unknown sort direction", { sort: "sideways" }],
      ["a page size of 0", { pageSize: "0" }],
      ["a page size past the limit", { pageSize: "500" }],
      ["a page size that is not a number", { pageSize: "many" }],
      ["a negative start page", { startPage: "-1" }],
      ["an empty label", { label: "" }],
      ["a label past 225 characters", { label: "x".repeat(226) }],
    ])("answers 400 for %s and asks Hasura nothing", async (_case, query) => {
      const res = await ctx.as(t().http().get(CHANGES).query(query));
      expect(res.status).toBe(400);
      expect(t().graphql.request).not.toHaveBeenCalled();
    });
  });
});
