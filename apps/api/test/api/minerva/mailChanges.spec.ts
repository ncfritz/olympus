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
        labelOps: [],
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
            labelOps: [],
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
        labelOps: [],
      });
    });

    it("puts an approval's flags back: into the inbox, unread", async () => {
      linked();
      labels();
      toUndo({
        changes: [
          {
            gmailId: "a1",
            messageId: "msg-a1",
            status: "written",
            message: null,
            labels: [
              { role: "had", name: "Accounts/A" },
              { role: "add", name: "Travel" },
              { role: "remove", name: "INBOX" },
              { role: "remove", name: "UNREAD" },
            ],
          },
        ],
      });
      ctx.t.graphql.on("CreateMailChangeBatch", {
        insert_minerva_mail_change_batches_one: { id: UNDO_ID },
      });
      ctx.t.graphql.on("CreateMailChanges", {
        insert_minerva_mail_changes: { affected_rows: 1 },
      });

      expect((await undo()).status).toBe(201);
      expect(agent.startWrites.mock.calls[0][0].changes).toEqual([
        {
          gmailId: "a1",
          // Flags are never what Gmail must still have.
          expected: ["Accounts/A", "Travel"],
          add: [
            { name: "INBOX", gmailLabelId: "INBOX" },
            { name: "UNREAD", gmailLabelId: "UNREAD" },
          ],
          remove: [{ name: "Travel", gmailLabelId: "Label_2" }],
        },
      ]);
    });

    it.each([
      ["an undo", { kind: "undo" }, /An undo cannot be undone/],
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

  describe("new labels and merges", () => {
    it("creates a new sub-label first, and moves messages into it", async () => {
      linked();
      labels();
      ctx.t.graphql.on("ListMailMessagesForChanges", {
        minerva_mail_messages: [message("a1", ["Travel"])],
      });
      ctx.t.graphql.on("CreateMailChangeBatch", {
        insert_minerva_mail_change_batches_one: { id: BATCH_ID },
      });
      ctx.t.graphql.on("CreateMailChanges", {
        insert_minerva_mail_changes: { affected_rows: 1 },
      });
      const res = await ctx.as(
        ctx.t
          .http()
          .post(`${BASE}/mail/account/${ACCOUNT_ID}/change-batches`)
          .send({
            newLabels: ["Travel/Japan"],
            changes: [
              { gmailId: "a1", add: ["Travel/Japan"], remove: ["Travel"] },
            ],
          }),
      );
      expect(res.status).toBe(201);
      expect(
        ctx.t.graphql.calls("CreateMailChangeBatch")[0].variables,
      ).toMatchObject({
        batch: {
          kind: "apply",
          labelOps: { data: [{ op: "create", name: "Travel/Japan" }] },
        },
      });
      expect(agent.startWrites.mock.calls[0][0]).toMatchObject({
        changes: [
          {
            gmailId: "a1",
            add: [{ name: "Travel/Japan" }],
            remove: [{ name: "Travel", gmailLabelId: "Label_2" }],
          },
        ],
        labelOps: [{ op: "create", name: "Travel/Japan" }],
      });
    });

    it("answers 400 to a new label that is removed, or a name that is not a path", async () => {
      for (const body of [
        {
          newLabels: ["New"],
          changes: [{ gmailId: "a1", add: ["Travel"], remove: ["New"] }],
        },
        {
          newLabels: ["Bad//Name"],
          changes: [{ gmailId: "a1", add: ["Bad//Name"], remove: [] }],
        },
      ]) {
        const res = await ctx.as(
          ctx.t
            .http()
            .post(`${BASE}/mail/account/${ACCOUNT_ID}/change-batches`)
            .send(body),
        );
        expect(res.status).toBe(400);
      }
    });

    const mergeLabels = () => {
      ctx.t.graphql.on("ListMailLabelsForMerge", {
        minerva_mail_labels: [
          {
            id: "l-b",
            name: "zz-test/b",
            type: "user",
            gmailLabelId: "Label_b",
          },
          {
            id: "l-bx",
            name: "zz-test/b/x",
            type: "user",
            gmailLabelId: "Label_bx",
          },
          {
            id: "l-by",
            name: "zz-test/b/y",
            type: "user",
            gmailLabelId: "Label_by",
          },
        ],
      });
      ctx.t.graphql.on("ListMailLabelsForChanges", {
        minerva_mail_labels: [
          {
            id: "l-a",
            name: "zz-test/a",
            type: "user",
            gmailLabelId: "Label_a",
          },
          {
            id: "l-ay",
            name: "zz-test/a/y",
            type: "user",
            gmailLabelId: "Label_ay",
          },
          {
            id: "l-b",
            name: "zz-test/b",
            type: "user",
            gmailLabelId: "Label_b",
          },
          {
            id: "l-bx",
            name: "zz-test/b/x",
            type: "user",
            gmailLabelId: "Label_bx",
          },
          {
            id: "l-by",
            name: "zz-test/b/y",
            type: "user",
            gmailLabelId: "Label_by",
          },
        ],
      });
      ctx.t.graphql.on("ListMailMessagesWithLabels", (vars) => ({
        minerva_mail_messages:
          (vars as { after: string }).after === ""
            ? [
                message("b1", ["zz-test/b"]),
                message("b2", ["zz-test/b/y", "zz-test/b/x"]),
              ]
            : [],
      }));
    };

    it("previews a merge: messages moved, children renamed or merged, labels deleted", async () => {
      linked();
      mergeLabels();
      const res = await ctx.as(
        ctx.t
          .http()
          .get(`${BASE}/mail/account/${ACCOUNT_ID}/labels/merge-preview`)
          .query({ from: "zz-test/b", into: "zz-test/a" }),
      );
      expect(res.status).toBe(200);
      expect(res.body.preview).toEqual({
        from: "zz-test/b",
        into: "zz-test/a",
        messages: 2,
        merges: [
          { from: "zz-test/b", to: "zz-test/a", messages: 1 },
          { from: "zz-test/b/y", to: "zz-test/a/y", messages: 1 },
        ],
        renames: [{ from: "zz-test/b/x", to: "zz-test/a/x" }],
        deletes: ["zz-test/b", "zz-test/b/y"],
      });
      expect(
        ctx.t.graphql.calls("ListMailMessagesWithLabels")[0].variables,
      ).toMatchObject({ names: ["zz-test/b", "zz-test/b/y"] });
      expect(agent.startWrites).not.toHaveBeenCalled();
    });

    it("merges as one batch: renames, then messages, then deletes", async () => {
      linked();
      mergeLabels();
      ctx.t.graphql.on("CreateMailChangeBatch", {
        insert_minerva_mail_change_batches_one: { id: BATCH_ID },
      });
      ctx.t.graphql.on("CreateMailChanges", {
        insert_minerva_mail_changes: { affected_rows: 2 },
      });
      const res = await ctx.as(
        ctx.t
          .http()
          .post(`${BASE}/mail/account/${ACCOUNT_ID}/labels/merge`)
          .send({ from: "zz-test/b", into: "zz-test/a" }),
      );
      expect(res.status).toBe(201);
      expect(res.headers.location).toBe(
        `/v1/minerva/mail/change-batch/${BATCH_ID}`,
      );
      expect(
        ctx.t.graphql.calls("CreateMailChangeBatch")[0].variables,
      ).toMatchObject({
        batch: {
          kind: "merge",
          labelOps: {
            data: [
              { op: "rename", name: "zz-test/b/x", newName: "zz-test/a/x" },
              { op: "delete", name: "zz-test/b" },
              { op: "delete", name: "zz-test/b/y" },
            ],
          },
        },
      });
      expect(agent.startWrites.mock.calls[0][0]).toMatchObject({
        changes: [
          {
            gmailId: "b1",
            expected: ["zz-test/b"],
            add: [{ name: "zz-test/a", gmailLabelId: "Label_a" }],
            remove: [{ name: "zz-test/b", gmailLabelId: "Label_b" }],
          },
          {
            gmailId: "b2",
            expected: ["zz-test/b/x", "zz-test/b/y"],
            add: [{ name: "zz-test/a/y", gmailLabelId: "Label_ay" }],
            remove: [{ name: "zz-test/b/y", gmailLabelId: "Label_by" }],
          },
        ],
        labelOps: [
          {
            op: "rename",
            name: "zz-test/b/x",
            newName: "zz-test/a/x",
            gmailLabelId: "Label_bx",
          },
          { op: "delete", name: "zz-test/b", gmailLabelId: "Label_b" },
          { op: "delete", name: "zz-test/b/y", gmailLabelId: "Label_by" },
        ],
      });
    });

    it.each([
      ["into itself", { from: "zz-test/b", into: "zz-test/b" }],
      ["into its own child", { from: "zz-test/b", into: "zz-test/b/x" }],
    ])("answers 400 to a merge %s", async (_case, body) => {
      linked();
      const res = await ctx.as(
        ctx.t
          .http()
          .post(`${BASE}/mail/account/${ACCOUNT_ID}/labels/merge`)
          .send(body),
      );
      expect(res.status).toBe(400);
    });

    it("undoes a merge: labels back first, messages back, renames reversed", async () => {
      linked();
      ctx.t.graphql.on("ListMailLabelsForChanges", {
        minerva_mail_labels: [
          {
            id: "l-a",
            name: "zz-test/a",
            type: "user",
            gmailLabelId: "Label_a",
          },
        ],
      });
      ctx.t.graphql.on("DescribeMailChangeBatchToUndo", {
        minerva_mail_change_batches: [
          {
            id: BATCH_ID,
            accountId: ACCOUNT_ID,
            kind: "merge",
            status: "done",
            undoneBy: [],
            labelOps: [
              {
                op: "rename",
                name: "zz-test/b/x",
                newName: "zz-test/a/x",
                status: "done",
                detail: null,
              },
              {
                op: "delete",
                name: "zz-test/b",
                status: "done",
                newName: null,
                detail: null,
              },
            ],
            changes: [
              {
                gmailId: "b1",
                messageId: "msg-b1",
                status: "written",
                message: null,
                labels: [
                  { role: "had", name: "zz-test/b" },
                  { role: "had", name: "zz-test/b/x" },
                  { role: "add", name: "zz-test/a" },
                  { role: "remove", name: "zz-test/b" },
                ],
              },
            ],
          },
        ],
      });
      ctx.t.graphql.on("CreateMailChangeBatch", {
        insert_minerva_mail_change_batches_one: { id: UNDO_ID },
      });
      ctx.t.graphql.on("CreateMailChanges", {
        insert_minerva_mail_changes: { affected_rows: 1 },
      });
      const res = await ctx.as(
        ctx.t.http().post(`${BASE}/mail/change-batch/${BATCH_ID}/undo`),
      );
      expect(res.status).toBe(201);
      expect(agent.startWrites.mock.calls[0][0]).toMatchObject({
        changes: [
          {
            gmailId: "b1",
            // What the merge left, in today's names.
            expected: ["zz-test/a", "zz-test/a/x"],
            add: [{ name: "zz-test/b" }],
            remove: [{ name: "zz-test/a", gmailLabelId: "Label_a" }],
          },
        ],
        labelOps: [
          { op: "rename", name: "zz-test/a/x", newName: "zz-test/b/x" },
          { op: "create", name: "zz-test/b" },
        ],
      });
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

  describe("ApplyMatchingMailProposals and DismissMatchingMailProposals", () => {
    const open = (rows: [string, string, string][]) =>
      ctx.t.graphql.on("ListOpenMailProposals", (vars) => ({
        minerva_mail_proposals:
          (vars as { offset: number }).offset === 0
            ? rows.map(([gmailId, label, action]) => ({
                action,
                label: { name: label },
                message: { accountId: ACCOUNT_ID, gmailId },
              }))
            : [],
      }));

    it("applies every open, ticked proposal the filter matches, a change per message", async () => {
      linked();
      labels();
      open([
        ["a1", "Travel", "add"],
        ["a1", "Accounts/A", "remove"],
        ["a2", "Travel", "add"],
        ["a3", "Travel", "add"],
        ["a3", "Travel", "remove"],
      ]);
      ctx.t.graphql.on("ListMailMessagesForChanges", {
        minerva_mail_messages: [
          message("a1", ["Accounts/A"]),
          message("a2", []),
        ],
      });
      ctx.t.graphql.on("CreateMailChangeBatch", {
        insert_minerva_mail_change_batches_one: { id: BATCH_ID },
      });
      ctx.t.graphql.on("CreateMailChanges", {
        insert_minerva_mail_changes: { affected_rows: 2 },
      });

      const res = await ctx.as(
        ctx.t
          .http()
          .post(`${BASE}/mail/proposals/apply`)
          .send({
            filter: { label: "Travel", rule: "classifier", minConfidence: 0.9 },
          }),
      );

      expect(res.status).toBe(200);
      expect(res.body.proposals).toBe(5);
      expect(res.body.batches).toHaveLength(1);
      expect(
        ctx.t.graphql.calls("ListOpenMailProposals")[0].variables,
      ).toMatchObject({
        where: {
          account: { userId: { _eq: USER } },
          label: { name: { _eq: "Travel" } },
          rule: { _eq: "classifier" },
          confidence: { _gte: 0.9 },
          decision: { _is_null: true },
          _or: [{ ticked: { _is_null: true } }, { ticked: { _eq: true } }],
        },
      });
      // a3's add and remove cancel out.
      expect(agent.startWrites.mock.calls[0][0].changes).toEqual([
        {
          gmailId: "a1",
          expected: ["Accounts/A"],
          add: [{ name: "Travel", gmailLabelId: "Label_2" }],
          remove: [{ name: "Accounts/A", gmailLabelId: "Label_1" }],
        },
        {
          gmailId: "a2",
          expected: [],
          add: [{ name: "Travel", gmailLabelId: "Label_2" }],
          remove: [],
        },
      ]);
    });

    it("starts nothing when nothing matches", async () => {
      open([]);
      const res = await ctx.as(
        ctx.t.http().post(`${BASE}/mail/proposals/apply`).send({ filter: {} }),
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ proposals: 0, batches: [] });
      expect(agent.startWrites).not.toHaveBeenCalled();
    });

    it("dismisses every open proposal the filter matches, unticked too", async () => {
      linked();
      labels();
      open([["a1", "Travel", "add"]]);
      ctx.t.graphql.on("ListMailMessagesForChanges", {
        minerva_mail_messages: [message("a1", [])],
      });
      ctx.t.graphql.on("DismissMailProposals", {
        insert_minerva_mail_decisions: { affected_rows: 1 },
      });
      const res = await ctx.as(
        ctx.t
          .http()
          .post(`${BASE}/mail/proposals/dismiss`)
          .send({ filter: { label: "Travel" } }),
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ dismissed: 1 });
      const where = (
        ctx.t.graphql.calls("ListOpenMailProposals")[0].variables as {
          where: Record<string, unknown>;
        }
      ).where;
      expect(where).not.toHaveProperty("_or");
      expect(agent.startWrites).not.toHaveBeenCalled();
    });

    it.each([
      ["no filter", {}],
      ["an unknown action", { filter: { action: "move" } }],
      ["a confidence above 1", { filter: { minConfidence: 2 } }],
    ])("answers 400 to %s", async (_case, body) => {
      const res = await ctx.as(
        ctx.t.http().post(`${BASE}/mail/proposals/apply`).send(body),
      );
      expect(res.status).toBe(400);
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
