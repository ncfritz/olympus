import { BadGatewayException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MinervaMailAgentClient } from "../../../src/minerva/mail/services/MinervaMailAgentClient";
import { signedInApp, USER } from "../../support/signedInApp";

const BASE = "/v1/minerva";
const ACCOUNT_ID = "7b2b0000-0000-4000-8000-000000000001";
const BATCH_ID = "7b2b0000-0000-4000-8000-0000000000b1";
const UNDO_ID = "7b2b0000-0000-4000-8000-0000000000b2";
const WRITE_SCOPE =
  "openid email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify";

const agent = {
  startSignIn: vi.fn(),
  completeSignIn: vi.fn(),
  deleteAccount: vi.fn(),
  startWrites: vi.fn(),
};

const count = (n: number) => ({ aggregate: { count: n } });

const batchRow = (overrides = {}) => ({
  id: BATCH_ID,
  accountId: ACCOUNT_ID,
  kind: "apply",
  undoesBatchId: null,
  status: "pending",
  requestedTime: "2026-10-06T21:00:00Z",
  finishedTime: null,
  error: null,
  undoneBy: [],
  total: count(2),
  pending: count(2),
  written: count(0),
  unchanged: count(0),
  changed: count(0),
  gone: count(0),
  failed: count(0),
  changes: [],
  ...overrides,
});

const message = (gmailId: string, labels: string[]) => ({
  id: `msg-${gmailId}`,
  gmailId,
  messageLabels: [
    ...labels.map((name) => ({ label: { name, type: "user" } })),
    { label: { name: "CATEGORY_UPDATES", type: "system" } },
  ],
});

/**
 * Writes to Gmail (docs/plans/email-management phase 4): the user's side.
 * The agent is a mock; its own specs cover the writing.
 */
describe("Mail changes", () => {
  const ctx = signedInApp({
    env: { MINERVA_MAIL_WRITES_ENABLED: "true" },
    overrides: [{ provide: MinervaMailAgentClient, useValue: agent }],
  });

  const linked = (linkScope = WRITE_SCOPE) =>
    ctx.t.graphql.on("DescribeMailAccountForChanges", (vars) => ({
      minerva_mail_accounts:
        (vars as { userId: string }).userId === USER
          ? [
              {
                id: ACCOUNT_ID,
                userId: USER,
                email: "neil@example.com",
                linkScope,
              },
            ]
          : [],
    }));

  const labels = () =>
    ctx.t.graphql.on("ListMailLabelsForChanges", {
      minerva_mail_labels: [
        {
          id: "l-travel",
          name: "Travel",
          type: "user",
          gmailLabelId: "Label_2",
        },
        {
          id: "l-a",
          name: "Accounts/A",
          type: "user",
          gmailLabelId: "Label_1",
        },
        { id: "l-new", name: "Not in Gmail", type: "user", gmailLabelId: null },
      ],
    });

  beforeEach(() => {
    for (const fn of Object.values(agent)) fn.mockReset();
    ctx.t.graphql.on("DescribeMailChangeBatch", {
      minerva_mail_change_batches: [batchRow()],
    });
  });

  describe("ApplyMailChanges", () => {
    const apply = (body: object) =>
      ctx.as(
        ctx.t
          .http()
          .post(`${BASE}/mail/account/${ACCOUNT_ID}/change-batches`)
          .send(body),
      );

    it("records each message's labels as they are, then hands the batch to the agent", async () => {
      linked();
      labels();
      ctx.t.graphql.on("ListMailMessagesForChanges", {
        minerva_mail_messages: [
          message("a1", ["Accounts/A"]),
          message("a2", ["Accounts/A", "Travel"]),
        ],
      });
      ctx.t.graphql.on("CreateMailChangeBatch", {
        insert_minerva_mail_change_batches_one: { id: BATCH_ID },
      });
      ctx.t.graphql.on("CreateMailChanges", {
        insert_minerva_mail_changes: { affected_rows: 2 },
      });

      const res = await apply({
        changes: [
          { gmailId: "a1", add: ["Travel"], remove: [] },
          { gmailId: "a2", add: [], remove: ["Accounts/A"] },
        ],
      });

      expect(res.status).toBe(201);
      expect(res.headers.location).toBe(
        `/v1/minerva/mail/change-batch/${BATCH_ID}`,
      );
      expect(res.body.batch).toMatchObject({
        id: BATCH_ID,
        kind: "apply",
        status: "pending",
        messages: 2,
        counts: { pending: 2, written: 0 },
      });
      expect(ctx.t.graphql.calls("CreateMailChangeBatch")[0].variables).toEqual(
        { batch: { accountId: ACCOUNT_ID, userId: USER, kind: "apply" } },
      );
      expect(ctx.t.graphql.calls("CreateMailChanges")[0].variables).toEqual({
        changes: [
          {
            batchId: BATCH_ID,
            gmailId: "a1",
            messageId: "msg-a1",
            labels: {
              data: [
                { role: "had", name: "Accounts/A" },
                { role: "add", name: "Travel" },
              ],
            },
          },
          {
            batchId: BATCH_ID,
            gmailId: "a2",
            messageId: "msg-a2",
            labels: {
              data: [
                { role: "had", name: "Accounts/A" },
                { role: "had", name: "Travel" },
                { role: "remove", name: "Accounts/A" },
              ],
            },
          },
        ],
      });
      expect(agent.startWrites).toHaveBeenCalledWith({
        batchId: BATCH_ID,
        accountId: ACCOUNT_ID,
        email: "neil@example.com",
        changes: [
          {
            gmailId: "a1",
            expected: ["Accounts/A"],
            add: [{ name: "Travel", gmailLabelId: "Label_2" }],
            remove: [],
          },
          {
            gmailId: "a2",
            expected: ["Accounts/A", "Travel"],
            add: [],
            remove: [{ name: "Accounts/A", gmailLabelId: "Label_1" }],
          },
        ],
      });
    });

    it("marks the batch failed when the agent does not take it", async () => {
      linked();
      labels();
      ctx.t.graphql.on("ListMailMessagesForChanges", {
        minerva_mail_messages: [message("a1", [])],
      });
      ctx.t.graphql.on("CreateMailChangeBatch", {
        insert_minerva_mail_change_batches_one: { id: BATCH_ID },
      });
      ctx.t.graphql.on("CreateMailChanges", {
        insert_minerva_mail_changes: { affected_rows: 1 },
      });
      ctx.t.graphql.on("FailMailChangeBatch", {
        update_minerva_mail_change_batches_by_pk: { id: BATCH_ID },
      });
      agent.startWrites.mockRejectedValue(
        new BadGatewayException("The mail agent could not StartGmailWrites"),
      );

      const res = await apply({
        changes: [{ gmailId: "a1", add: ["Travel"], remove: [] }],
      });

      expect(res.status).toBe(502);
      expect(
        ctx.t.graphql.calls("FailMailChangeBatch")[0].variables,
      ).toMatchObject({
        id: BATCH_ID,
        set: {
          status: "failed",
          error: "The mail agent did not take the batch",
        },
      });
    });

    it("answers 409 for a mailbox linked for reading only", async () => {
      linked("openid email https://www.googleapis.com/auth/gmail.readonly");
      const res = await apply({
        changes: [{ gmailId: "a1", add: ["Travel"], remove: [] }],
      });
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/allow changes/);
      expect(agent.startWrites).not.toHaveBeenCalled();
    });

    it("answers 400 for a label Gmail does not have, or a message the account lacks", async () => {
      linked();
      labels();
      ctx.t.graphql.on("ListMailMessagesForChanges", {
        minerva_mail_messages: [message("a1", [])],
      });
      const noLabel = await apply({
        changes: [{ gmailId: "a1", add: ["Not in Gmail"], remove: [] }],
      });
      expect(noLabel.status).toBe(400);
      expect(noLabel.body.message).toContain("Not in Gmail");

      const noMessage = await apply({
        changes: [{ gmailId: "ff", add: ["Travel"], remove: [] }],
      });
      expect(noMessage.status).toBe(400);
      expect(noMessage.body.message).toContain("ff");
      expect(ctx.t.graphql.calls("CreateMailChangeBatch")).toHaveLength(0);
    });

    it.each([
      ["no changes", { changes: [] }],
      [
        "a change that changes nothing",
        { changes: [{ gmailId: "a1", add: [], remove: [] }] },
      ],
      [
        "a label added and removed",
        { changes: [{ gmailId: "a1", add: ["Travel"], remove: ["Travel"] }] },
      ],
      [
        "a message twice",
        {
          changes: [
            { gmailId: "a1", add: ["Travel"], remove: [] },
            { gmailId: "a1", add: [], remove: ["Travel"] },
          ],
        },
      ],
      [
        "a Gmail ID that is not one",
        { changes: [{ gmailId: "zz", add: ["Travel"], remove: [] }] },
      ],
    ])("answers 400 to %s", async (_case, body) => {
      const res = await apply(body);
      expect(res.status).toBe(400);
    });

    it("answers 404 for another user's account", async () => {
      ctx.t.graphql.on("DescribeMailAccountForChanges", {
        minerva_mail_accounts: [],
      });
      const res = await apply({
        changes: [{ gmailId: "a1", add: ["Travel"], remove: [] }],
      });
      expect(res.status).toBe(404);
    });
  });

  describe("UndoMailChangeBatch", () => {
    const undo = () =>
      ctx.as(ctx.t.http().post(`${BASE}/mail/change-batch/${BATCH_ID}/undo`));

    const toUndo = (overrides = {}) =>
      ctx.t.graphql.on("DescribeMailChangeBatchToUndo", {
        minerva_mail_change_batches: [
          {
            id: BATCH_ID,
            accountId: ACCOUNT_ID,
            kind: "apply",
            status: "done",
            undoneBy: [],
            changes: [
              {
                gmailId: "a1",
                messageId: "msg-a1",
                status: "written",
                message: null,
                labels: [
                  { role: "had", name: "Accounts/A" },
                  { role: "add", name: "Travel" },
                  { role: "remove", name: "Accounts/A" },
                ],
              },
            ],
            ...overrides,
          },
        ],
      });

    it("reverses what was written, against the labels it left", async () => {
      linked();
      labels();
      toUndo();
      ctx.t.graphql.on("CreateMailChangeBatch", {
        insert_minerva_mail_change_batches_one: { id: UNDO_ID },
      });
      ctx.t.graphql.on("CreateMailChanges", {
        insert_minerva_mail_changes: { affected_rows: 1 },
      });
      ctx.t.graphql.on("DescribeMailChangeBatch", {
        minerva_mail_change_batches: [
          batchRow({ id: UNDO_ID, kind: "undo", undoesBatchId: BATCH_ID }),
        ],
      });

      const res = await undo();

      expect(res.status).toBe(201);
      expect(res.headers.location).toBe(
        `/v1/minerva/mail/change-batch/${UNDO_ID}`,
      );
      expect(res.body.batch).toMatchObject({
        id: UNDO_ID,
        kind: "undo",
        undoesBatchId: BATCH_ID,
      });
      expect(ctx.t.graphql.calls("CreateMailChangeBatch")[0].variables).toEqual(
        {
          batch: {
            accountId: ACCOUNT_ID,
            userId: USER,
            kind: "undo",
            undoesBatchId: BATCH_ID,
          },
        },
      );
      expect(agent.startWrites).toHaveBeenCalledWith({
        batchId: UNDO_ID,
        accountId: ACCOUNT_ID,
        email: "neil@example.com",
        changes: [
          {
            gmailId: "a1",
            expected: ["Travel"],
            add: [{ name: "Accounts/A", gmailLabelId: "Label_1" }],
            remove: [{ name: "Travel", gmailLabelId: "Label_2" }],
          },
        ],
      });
    });

    it.each([
      ["an undo", { kind: "undo" }, /Only an apply/],
      ["a batch still running", { status: "running" }, /not finished/],
      [
        "a batch undone already",
        { undoneBy: [{ id: UNDO_ID }] },
        /undone already/,
      ],
      ["a batch that wrote nothing", { changes: [] }, /nothing to undo/],
    ])("answers 409 for %s", async (_case, overrides, message) => {
      toUndo(overrides);
      const res = await undo();
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(message);
      expect(agent.startWrites).not.toHaveBeenCalled();
    });

    it("answers 404 for a batch that is not the caller's", async () => {
      ctx.t.graphql.on("DescribeMailChangeBatchToUndo", {
        minerva_mail_change_batches: [],
      });
      expect((await undo()).status).toBe(404);
    });
  });

  describe("ListMailChangeBatches and DescribeMailChangeBatch", () => {
    it("lists the account's batches with their counts", async () => {
      ctx.t.graphql.on("ListMailChangeBatches", {
        minerva_mail_change_batches: [
          batchRow({
            status: "done",
            finishedTime: "2026-10-06T21:01:00Z",
            pending: count(0),
            written: count(1),
            changed: count(1),
            undoneBy: [{ id: UNDO_ID }],
          }),
        ],
      });
      const res = await ctx.as(
        ctx.t
          .http()
          .get(`${BASE}/mail/account/${ACCOUNT_ID}/change-batches?limit=10`),
      );
      expect(res.status).toBe(200);
      expect(res.body.batches[0]).toMatchObject({
        status: "done",
        undoneByBatchId: UNDO_ID,
        finishedTime: "2026-10-06T21:01:00.000Z",
        counts: { pending: 0, written: 1, changed: 1 },
      });
      expect(ctx.t.graphql.calls("ListMailChangeBatches")[0].variables).toEqual(
        { accountId: ACCOUNT_ID, userId: USER, limit: 10 },
      );
    });

    it("describes a batch with a page of its changes", async () => {
      ctx.t.graphql.on("DescribeMailChangeBatch", {
        minerva_mail_change_batches: [
          batchRow({
            changes: [
              {
                gmailId: "a1",
                messageId: "msg-a1",
                status: "written",
                message: {
                  subject: "Your trip",
                  fromAddress: "air@example.com",
                },
                labels: [
                  { role: "had", name: "Accounts/A" },
                  { role: "add", name: "Travel" },
                ],
              },
            ],
          }),
        ],
      });
      const res = await ctx.as(
        ctx.t
          .http()
          .get(`${BASE}/mail/change-batch/${BATCH_ID}?offset=100&limit=50`),
      );
      expect(res.status).toBe(200);
      expect(res.body.changes).toEqual([
        {
          gmailId: "a1",
          subject: "Your trip",
          fromAddress: "air@example.com",
          status: "written",
          had: ["Accounts/A"],
          add: ["Travel"],
          remove: [],
        },
      ]);
      expect(
        ctx.t.graphql.calls("DescribeMailChangeBatch").at(-1)?.variables,
      ).toEqual({ id: BATCH_ID, userId: USER, offset: 100, limit: 50 });
    });
  });

  describe("DismissMailProposals", () => {
    it("records the decision for proposals the account has", async () => {
      linked();
      labels();
      ctx.t.graphql.on("ListMailMessagesForChanges", {
        minerva_mail_messages: [message("a1", ["Accounts/A"])],
      });
      ctx.t.graphql.on("DismissMailProposals", {
        insert_minerva_mail_decisions: { affected_rows: 1 },
      });
      const res = await ctx.as(
        ctx.t
          .http()
          .post(`${BASE}/mail/account/${ACCOUNT_ID}/proposals/dismiss`)
          .send({
            proposals: [
              { gmailId: "a1", label: "Travel", action: "add" },
              { gmailId: "a9", label: "Travel", action: "add" },
            ],
          }),
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ dismissed: 1 });
      expect(ctx.t.graphql.calls("DismissMailProposals")[0].variables).toEqual({
        decisions: [
          {
            accountId: ACCOUNT_ID,
            messageId: "msg-a1",
            labelId: "l-travel",
            action: "add",
            decision: "dismissed",
            userId: USER,
          },
        ],
      });
      expect(agent.startWrites).not.toHaveBeenCalled();
    });
  });
});

describe("Mail changes with writes turned off", () => {
  const ctx = signedInApp({
    overrides: [{ provide: MinervaMailAgentClient, useValue: agent }],
  });

  it.each([
    ["post", `${BASE}/mail/account/${ACCOUNT_ID}/change-batches`],
    ["post", `${BASE}/mail/change-batch/${BATCH_ID}/undo`],
  ] as const)("%s %s answers 503", async (method, path) => {
    const res = await ctx.as(
      ctx.t
        .http()
        [method](path)
        .send({ changes: [{ gmailId: "a1", add: ["Travel"], remove: [] }] }),
    );
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/MINERVA_MAIL_WRITES_ENABLED/);
    expect(agent.startWrites).not.toHaveBeenCalled();
  });
});
