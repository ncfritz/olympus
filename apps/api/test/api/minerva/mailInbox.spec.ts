import { beforeEach, describe, expect, it, vi } from "vitest";
import { MinervaMailAgentClient } from "../../../src/minerva/mail/services/MinervaMailAgentClient";
import { signedInApp, USER } from "../../support/signedInApp";

const BASE = "/v1/minerva";
const ACCOUNT_ID = "7b2b0000-0000-4000-8000-000000000001";
const BATCH_ID = "7b2b0000-0000-4000-8000-0000000000b1";
const INBOX = `${BASE}/mail/account/${ACCOUNT_ID}/inbox`;
const WRITE_SCOPE =
  "openid email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify";

const agent = {
  startSignIn: vi.fn(),
  completeSignIn: vi.fn(),
  deleteAccount: vi.fn(),
  startWrites: vi.fn(),
};

const count = (n: number) => ({ aggregate: { count: n } });

/* Synthetic mail (never real). */
const target = (
  gmailId: string,
  overrides: Partial<{
    threadId: string;
    inInbox: boolean;
    unread: boolean;
    labels: string[];
    suggested: { name: string; ticked: boolean }[] | null;
  }> = {},
) => ({
  id: `msg-${gmailId}`,
  gmailId,
  threadId: overrides.threadId ?? `t-${gmailId}`,
  inInbox: overrides.inInbox ?? true,
  unread: overrides.unread ?? true,
  messageLabels: (overrides.labels ?? []).map((name) => ({
    label: { name, type: "user" },
  })),
  score:
    overrides.suggested === null
      ? null
      : {
          modelRun: "6ca3f45f",
          suggestions: (
            overrides.suggested ?? [{ name: "Travel", ticked: true }]
          ).map((s) => ({ ticked: s.ticked, label: { name: s.name } })),
        },
});

const row = (overrides: Record<string, unknown> = {}) => ({
  accountId: ACCOUNT_ID,
  gmailId: "1a",
  threadId: "1a",
  threadSize: 2,
  receivedTime: "2026-10-06T08:00:00+00:00",
  inInbox: true,
  unread: true,
  scoredTime: "2026-10-06T08:01:00+00:00",
  topScore: "0.962",
  decision: null,
  decidedTime: null,
  amended: null,
  message: {
    fromName: "Example Air",
    fromAddress: "trips@example.test",
    subject: "Your trip",
    snippet: "Your booking is confirmed",
    starred: false,
    starIcon: null,
    messageLabels: [
      { label: { name: "Accounts/A", type: "user" } },
      { label: { name: "CATEGORY_UPDATES", type: "system" } },
    ],
    score: {
      suggestions: [
        { rank: 1, score: "0.400", ticked: false, label: { name: "Bills" } },
        { rank: 0, score: "0.962", ticked: true, label: { name: "Travel" } },
        {
          rank: 2,
          score: "0.200",
          ticked: false,
          label: { name: "Accounts/A" },
        },
      ],
    },
  },
  ...overrides,
});

/**
 * The inbox (docs/plans/email-management phase 5): listing it, approving,
 * skipping, archiving and marking read. The agent is a mock.
 */
describe("Mail inbox", () => {
  const ctx = signedInApp({
    env: { MINERVA_MAIL_WRITES_ENABLED: "true" },
    overrides: [{ provide: MinervaMailAgentClient, useValue: agent }],
  });

  const owned = () =>
    ctx.t.graphql.on("DescribeMailInboxAccount", (vars) => ({
      minerva_mail_accounts:
        (vars as { userId: string }).userId === USER
          ? [{ id: ACCOUNT_ID }]
          : [],
    }));

  /** What a write needs: the account, Gmail's labels and a batch. */
  const writable = (messages: ReturnType<typeof target>[]) => {
    ctx.t.graphql.on("DescribeMailAccountForChanges", {
      minerva_mail_accounts: [
        {
          id: ACCOUNT_ID,
          userId: USER,
          email: "neil@example.com",
          linkScope: WRITE_SCOPE,
        },
      ],
    });
    ctx.t.graphql.on("ListMailLabelsForChanges", (vars) => ({
      minerva_mail_labels: [
        {
          id: "l-travel",
          name: "Travel",
          type: "user",
          gmailLabelId: "Label_2",
        },
        { id: "l-bills", name: "Bills", type: "user", gmailLabelId: "Label_3" },
      ].filter((l) => (vars as { names: string[] }).names.includes(l.name)),
    }));
    ctx.t.graphql.on("ListMailMessagesForChanges", {
      minerva_mail_messages: messages.map((m) => ({
        id: m.id,
        gmailId: m.gmailId,
        messageLabels: m.messageLabels,
      })),
    });
    ctx.t.graphql.on("CreateMailChangeBatch", {
      insert_minerva_mail_change_batches_one: { id: BATCH_ID },
    });
    ctx.t.graphql.on("CreateMailChanges", {
      insert_minerva_mail_changes: { affected_rows: messages.length },
    });
    ctx.t.graphql.on("DescribeMailChangeBatch", {
      minerva_mail_change_batches: [
        {
          id: BATCH_ID,
          accountId: ACCOUNT_ID,
          kind: "apply",
          undoesBatchId: null,
          status: "pending",
          requestedTime: "2026-10-06T21:00:00Z",
          finishedTime: null,
          error: null,
          undoneBy: [],
          total: count(messages.length),
          pending: count(messages.length),
          written: count(0),
          unchanged: count(0),
          changed: count(0),
          gone: count(0),
          failed: count(0),
          changes: [],
          labelOps: [],
        },
      ],
    });
  };

  const decisions = () =>
    ctx.t.graphql
      .calls("RecordMailInboxDecisions")
      .flatMap(
        (c) =>
          (c.variables as { decisions: Record<string, unknown>[] }).decisions,
      );

  beforeEach(() => {
    for (const fn of Object.values(agent)) fn.mockReset();
    ctx.t.graphql.on("RecordMailInboxDecisions", {
      insert_minerva_mail_inbox_decisions: { affected_rows: 1 },
    });
  });

  describe("ListMailInbox", () => {
    const list = (query = "") =>
      ctx.as(ctx.t.http().get(`${BASE}/mail/inbox${query}`));

    const page = (rows = [row()]) =>
      ctx.t.graphql.on("ListMailInbox", {
        page: rows,
        count: count(rows.length),
        inInbox: count(12),
        toReview: count(7),
        highConfidence: count(4),
        noSuggestion: count(2),
        unread: count(5),
        approved: count(3),
      });

    it("lists what is to review with its suggestions best first, and the counts", async () => {
      page();

      const res = await list();

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.summary).toEqual({
        inInbox: 12,
        toReview: 7,
        highConfidence: 4,
        noSuggestion: 2,
        unread: 5,
        approved: 3,
      });
      expect(res.body.messages[0]).toMatchObject({
        gmailId: "1a",
        threadSize: 2,
        fromName: "Example Air",
        subject: "Your trip",
        labels: ["Accounts/A"],
        topScore: 0.962,
        suggestions: [
          { label: "Travel", score: 0.962, ticked: true, onMessage: false },
          { label: "Bills", score: 0.4, ticked: false, onMessage: false },
          { label: "Accounts/A", score: 0.2, ticked: false, onMessage: true },
        ],
      });
      expect(res.body.messages[0].decision).toBeUndefined();
      const vars = ctx.t.graphql.calls("ListMailInbox")[0].variables as {
        where: { _and: Record<string, unknown>[] };
        orderBy: unknown;
        toReview: unknown;
      };
      expect(vars.where._and).toEqual([
        { account: { userId: { _eq: USER } } },
        { inInbox: { _eq: true }, decision: { _is_null: true } },
      ]);
      expect(vars.orderBy).toEqual([{ receivedTime: "desc" }]);
    });

    it("filters by search, confidence and account, most confident first", async () => {
      page([]);

      const res = await list(
        `?search=50%25_off&minConfidence=0.9&sortBy=confidence&accountId=${ACCOUNT_ID}`,
      );

      expect(res.status).toBe(200);
      const vars = ctx.t.graphql.calls("ListMailInbox")[0].variables as {
        where: { _and: Record<string, unknown>[] };
        orderBy: unknown;
      };
      expect(vars.where._and).toEqual([
        {
          account: { userId: { _eq: USER } },
          accountId: { _eq: ACCOUNT_ID },
        },
        { inInbox: { _eq: true }, decision: { _is_null: true } },
        { topScore: { _gte: 0.9 } },
        {
          message: {
            _or: [
              { subject: { _ilike: "%50\\%\\_off%" } },
              { fromAddress: { _ilike: "%50\\%\\_off%" } },
              { fromName: { _ilike: "%50\\%\\_off%" } },
            ],
          },
        },
      ]);
      expect(vars.orderBy).toEqual([
        { topScore: "desc_nulls_last" },
        { receivedTime: "desc" },
      ]);
    });

    it("lists what was approved since a time, newest decision first", async () => {
      page([
        row({
          inInbox: false,
          decision: "approved",
          decidedTime: "2026-10-06T09:00:00+00:00",
          amended: true,
        }),
      ]);

      const res = await list(
        "?status=approved&approvedSince=2026-10-06T07:00:00.000Z",
      );

      expect(res.status).toBe(200);
      expect(res.body.messages[0]).toMatchObject({
        decision: "approved",
        amended: true,
        inInbox: false,
      });
      const vars = ctx.t.graphql.calls("ListMailInbox")[0].variables as {
        where: { _and: Record<string, unknown>[] };
        orderBy: unknown;
      };
      expect(vars.where._and[1]).toEqual({
        decision: { _eq: "approved" },
        decidedTime: { _gte: "2026-10-06T07:00:00.000Z" },
      });
      expect(vars.orderBy).toEqual([{ decidedTime: "desc" }]);
    });

    it.each([
      ["a confidence past 1", "?minConfidence=2"],
      ["an approvedSince that is not a time", "?approvedSince=yesterday"],
      ["an accountId that is not one", "?accountId=7b2b"],
      ["a page too large", "?pageSize=101"],
      ["an unknown status", "?status=snoozed"],
    ])("answers 400 to %s", async (_case, query) => {
      const res = await list(query);
      expect(res.status).toBe(400);
      expect(ctx.t.graphql.calls("ListMailInbox")).toHaveLength(0);
    });
  });

  describe("ApproveMailMessages", () => {
    const approve = (body: object) =>
      ctx.as(ctx.t.http().post(`${INBOX}/approve`).send(body));

    it("writes the labels, archives and marks read, and records each approval", async () => {
      owned();
      const messages = [target("a1"), target("a2", { suggested: null })];
      ctx.t.graphql.on("ListMailInboxTargets", {
        minerva_mail_messages: messages,
      });
      writable(messages);

      const res = await approve({
        messages: [
          // As suggested.
          { gmailId: "a1", add: ["Travel"], remove: [] },
          // Not scored; labelled by hand.
          { gmailId: "a2", add: ["Bills"], remove: [] },
        ],
        archive: true,
        markRead: true,
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        approved: 2,
        changed: 2,
        batch: { id: BATCH_ID },
      });
      // The flags go to the agent as Gmail's own labels.
      expect(agent.startWrites.mock.calls[0][0].changes).toEqual([
        {
          gmailId: "a1",
          expected: [],
          add: [{ name: "Travel", gmailLabelId: "Label_2" }],
          remove: [
            { name: "INBOX", gmailLabelId: "INBOX" },
            { name: "UNREAD", gmailLabelId: "UNREAD" },
          ],
        },
        {
          gmailId: "a2",
          expected: [],
          add: [{ name: "Bills", gmailLabelId: "Label_3" }],
          remove: [
            { name: "INBOX", gmailLabelId: "INBOX" },
            { name: "UNREAD", gmailLabelId: "UNREAD" },
          ],
        },
      ]);
      expect(decisions()).toEqual([
        expect.objectContaining({
          messageId: "msg-a1",
          accountId: ACCOUNT_ID,
          decision: "approved",
          modelRun: "6ca3f45f",
          amended: false,
          batchId: BATCH_ID,
          userId: USER,
        }),
        expect.objectContaining({
          messageId: "msg-a2",
          amended: true,
          batchId: BATCH_ID,
        }),
      ]);
      expect(decisions()[1]).not.toHaveProperty("modelRun");
    });

    it("applies the same to the whole thread, deciding its messages in the inbox", async () => {
      owned();
      const a1 = target("a1", { threadId: "f1" });
      const mates = [
        a1,
        target("a3", { threadId: "f1", unread: false, labels: ["Travel"] }),
        target("a4", { threadId: "f1", inInbox: false, unread: false }),
      ];
      ctx.t.graphql.on("ListMailInboxTargets", { minerva_mail_messages: [a1] });
      ctx.t.graphql.on("ListMailInboxThreads", {
        minerva_mail_messages: mates,
      });
      writable(mates);

      const res = await approve({
        messages: [{ gmailId: "a1", add: ["Travel"], remove: [] }],
        archive: true,
        wholeThread: true,
      });

      expect(res.status).toBe(200);
      expect(
        ctx.t.graphql.calls("ListMailInboxThreads")[0].variables,
      ).toMatchObject({ threadIds: ["f1"] });
      const changes = agent.startWrites.mock.calls[0][0].changes as {
        gmailId: string;
        add: { name: string }[];
        remove: { name: string }[];
      }[];
      expect(
        changes.map((c) => [
          c.gmailId,
          c.add.map((l) => l.name),
          c.remove.map((l) => l.name),
        ]),
      ).toEqual([
        ["a1", ["Travel"], ["INBOX"]],
        // Has Travel: only archived.
        ["a3", [], ["INBOX"]],
        // Out of the inbox already: only labelled.
        ["a4", ["Travel"], []],
      ]);
      // a4 is not in the inbox: labelled, but nothing to decide.
      expect(decisions().map((d) => d.messageId)).toEqual(["msg-a1", "msg-a3"]);
    });

    it("records an approval that needs no change in Gmail, without a batch", async () => {
      owned();
      ctx.t.graphql.on("ListMailInboxTargets", {
        minerva_mail_messages: [target("a1", { labels: ["Travel"] })],
      });

      const res = await approve({
        messages: [{ gmailId: "a1", add: ["Travel"], remove: [] }],
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ approved: 1, changed: 0 });
      expect(agent.startWrites).not.toHaveBeenCalled();
      expect(decisions()).toEqual([
        expect.objectContaining({
          messageId: "msg-a1",
          amended: false,
          batchId: null,
        }),
      ]);
    });

    it.each([
      ["no messages", { messages: [] }],
      [
        "INBOX among the labels",
        { messages: [{ gmailId: "a1", add: [], remove: ["INBOX"] }] },
      ],
      [
        "a label added and removed",
        { messages: [{ gmailId: "a1", add: ["Travel"], remove: ["Travel"] }] },
      ],
      [
        "a message twice",
        {
          messages: [
            { gmailId: "a1", add: ["Travel"], remove: [] },
            { gmailId: "a1", add: [], remove: [] },
          ],
        },
      ],
      [
        "an archive that is not true or false",
        {
          messages: [{ gmailId: "a1", add: [], remove: [] }],
          archive: "yes",
        },
      ],
    ])("answers 400 to %s, before Hasura", async (_case, body) => {
      const res = await approve(body);
      expect(res.status).toBe(400);
      expect(ctx.t.graphql.calls("DescribeMailInboxAccount")).toHaveLength(0);
    });

    it("answers 400 for a message the account lacks, and 404 for another user's account", async () => {
      owned();
      ctx.t.graphql.on("ListMailInboxTargets", { minerva_mail_messages: [] });
      const missing = await approve({
        messages: [{ gmailId: "ff", add: ["Travel"], remove: [] }],
      });
      expect(missing.status).toBe(400);
      expect(missing.body.message).toContain("ff");

      ctx.t.graphql.on("DescribeMailInboxAccount", {
        minerva_mail_accounts: [],
      });
      const notMine = await approve({
        messages: [{ gmailId: "a1", add: ["Travel"], remove: [] }],
      });
      expect(notMine.status).toBe(404);
      expect(decisions()).toEqual([]);
    });
  });

  describe("SkipMailMessages", () => {
    it("records the skips and leaves Gmail alone", async () => {
      owned();
      ctx.t.graphql.on("ListMailInboxTargets", {
        minerva_mail_messages: [
          target("a1"),
          target("a2", { suggested: null }),
        ],
      });

      const res = await ctx.as(
        ctx.t
          .http()
          .post(`${INBOX}/skip`)
          .send({ gmailIds: ["a1", "a2"] }),
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ skipped: 2 });
      expect(decisions()).toEqual([
        expect.objectContaining({
          messageId: "msg-a1",
          decision: "skipped",
          modelRun: "6ca3f45f",
          amended: false,
          batchId: null,
        }),
        expect.objectContaining({ messageId: "msg-a2", decision: "skipped" }),
      ]);
      expect(agent.startWrites).not.toHaveBeenCalled();
    });

    it("answers 400 to Gmail IDs that are not", async () => {
      const res = await ctx.as(
        ctx.t
          .http()
          .post(`${INBOX}/skip`)
          .send({ gmailIds: ["zz"] }),
      );
      expect(res.status).toBe(400);
    });
  });

  describe("UpdateMailMessageFlags", () => {
    const flags = (body: object) =>
      ctx.as(ctx.t.http().post(`${INBOX}/flags`).send(body));

    it("archives what Minerva has in the inbox, deciding nothing", async () => {
      owned();
      const messages = [target("a1"), target("a2", { inInbox: false })];
      ctx.t.graphql.on("ListMailInboxTargets", {
        minerva_mail_messages: messages,
      });
      writable(messages);

      const res = await flags({ gmailIds: ["a1", "a2"], archive: true });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ changed: 1, batch: { id: BATCH_ID } });
      expect(agent.startWrites.mock.calls[0][0].changes).toEqual([
        {
          gmailId: "a1",
          expected: [],
          add: [],
          remove: [{ name: "INBOX", gmailLabelId: "INBOX" }],
        },
      ]);
      expect(decisions()).toEqual([]);
    });

    it("starts no batch when nothing needs changing", async () => {
      owned();
      ctx.t.graphql.on("ListMailInboxTargets", {
        minerva_mail_messages: [target("a1", { unread: false })],
      });
      const res = await flags({ gmailIds: ["a1"], markRead: true });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ changed: 0 });
      expect(agent.startWrites).not.toHaveBeenCalled();
    });

    it("answers 400 without archive or markRead", async () => {
      const res = await flags({ gmailIds: ["a1"] });
      expect(res.status).toBe(400);
    });
  });
});
