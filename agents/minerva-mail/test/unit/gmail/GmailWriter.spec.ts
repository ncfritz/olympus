import type { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import type { MailApi } from "@ncfritz/olympus-client";
import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { ClassifierClient } from "../../../src/classifier/ClassifierClient";
import type { GmailConfigType } from "../../../src/config/configuration";
import type {
  GmailClient,
  GmailLabelInfo,
  GmailMailbox,
} from "../../../src/gmail/GmailClient";
import type { GmailCredentialStore } from "../../../src/gmail/GmailCredentialStore";
import { GmailMessages } from "../../../src/gmail/GmailMessages";
import { GmailWriter } from "../../../src/gmail/GmailWriter";
import type {
  GmailWriteChange,
  StartGmailWritesRequest,
} from "../../../src/model/gmail";

/* A synthetic mailbox (never real mail). */
const BATCH_ID = "3f0c8d4e-1a2b-4c3d-8e9f-0a1b2c3d4e00";
const ACCOUNT_ID = "3f0c8d4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const EMAIL = "owner@example.net";
const MODIFY = "https://www.googleapis.com/auth/gmail.modify";

const LABELS: GmailLabelInfo[] = [
  { id: "INBOX", name: "INBOX", type: "system" },
  { id: "UNREAD", name: "UNREAD", type: "system" },
  { id: "STARRED", name: "STARRED", type: "system" },
  { id: "TRASH", name: "TRASH", type: "system" },
  { id: "Label_1", name: "Accounts/A", type: "user" },
  { id: "Label_2", name: "Travel", type: "user" },
  { id: "Label_3", name: "Bills", type: "user" },
];
const TRAVEL = { name: "Travel", gmailLabelId: "Label_2" };

/** Each message's labels in Gmail now. */
const GMAIL: Record<string, string[]> = {
  w1: ["INBOX", "Label_1"],
  w2: ["Label_1"],
  r1: ["Label_1", "Label_2"],
  u1: ["Label_1", "Label_2"],
  c1: ["Label_3"],
  t1: ["TRASH", "Label_1"],
  // In the inbox, unread, with Accounts/A.
  i1: ["INBOX", "UNREAD", "Label_1"],
  // Archived and read already, with Accounts/A and Travel.
  i2: ["Label_1", "Label_2"],
  // In the inbox; relabelled by hand since (Bills, not Accounts/A).
  i3: ["INBOX", "UNREAD", "Label_3"],
};

const change = (
  gmailId: string,
  add = [TRAVEL],
  remove: (typeof TRAVEL)[] = [],
  expected = ["Accounts/A"],
) => ({ gmailId, expected, add, remove });

const request = (
  changes: GmailWriteChange[] = [
    change("w1"),
    change("w2"),
    change("r1", [], [TRAVEL], ["Accounts/A", "Travel"]),
    change("u1"),
    change("c1"),
    change("g1"),
    change("t1"),
    change("f1"),
  ],
): StartGmailWritesRequest => ({
  batchId: BATCH_ID,
  accountId: ACCOUNT_ID,
  email: EMAIL,
  changes,
});

const setup = (
  options: { scope?: string; refuse?: boolean; writes?: boolean } = {},
) => {
  const published: { key: string; body: Record<string, unknown> }[] = [];
  const calls: string[] = [];
  let current: GmailLabelInfo[] = [...LABELS];
  const amqp = {
    publish: vi.fn(async (_exchange: string, key: string, body: never) => {
      published.push({ key, body });
    }),
  };
  const mail = { updateMailChangeBatch: vi.fn(async () => ({})) };
  const mailbox = {
    // Gmail's labels as they are: creates and renames show.
    labels: vi.fn(async () => [...current]),
    minimal: vi.fn(async (id: string) => {
      if (id === "f1") throw new Error("status 500");
      if (!GMAIL[id]) {
        throw Object.assign(new Error("status 404"), {
          response: { status: 404 },
        });
      }
      return { id, labelIds: GMAIL[id] };
    }),
    batchModify: vi.fn(async () => {
      if (options.refuse) throw new Error("status 400");
      calls.push("batchModify");
    }),
    createLabel: vi.fn(async (name: string) => {
      calls.push(`create ${name}`);
      const made = { id: `Label_new_${name}`, name, type: "user" as const };
      current.push(made);
      return made;
    }),
    renameLabel: vi.fn(async (id: string, name: string) => {
      calls.push(`rename ${id} ${name}`);
      current = current.map((l) => (l.id === id ? { ...l, name } : l));
    }),
    deleteLabel: vi.fn(async (id: string) => {
      calls.push(`delete ${id}`);
    }),
    labelTotals: vi.fn(async (id: string) => ({
      messagesTotal: id === "Label_3" ? 4 : 0,
      threadsTotal: 0,
    })),
  };
  const credentials = {
    load: vi.fn(() => ({
      refreshToken: "never-printed",
      scope: options.scope ?? `openid email ${MODIFY}`,
    })),
  };
  const writer = new GmailWriter(
    {
      clientId: "id",
      clientSecret: "secret",
      writesEnabled: options.writes ?? true,
    } as GmailConfigType,
    mail as unknown as MailApi,
    {} as GmailClient,
    credentials as unknown as GmailCredentialStore,
    new GmailMessages(
      amqp as unknown as AmqpConnection,
      { configured: false } as unknown as ClassifierClient,
      {} as MailApi,
    ),
  );
  const open = vi.fn(() => mailbox as unknown as GmailMailbox);
  const reports = () =>
    mail.updateMailChangeBatch.mock.calls.map(
      (c) => (c as unknown as [string, Record<string, unknown>])[1],
    );
  return { writer, open, mail, mailbox, published, reports, calls };
};

describe("GmailWriter", () => {
  it("writes what is as recorded, syncs what was changed in Gmail, and reports each", async () => {
    const { writer, open, mailbox, published, reports } = setup();

    const report = await writer.write(request(), open);

    expect(report).toEqual({
      batchId: BATCH_ID,
      status: "done",
      counts: { written: 3, unchanged: 1, changed: 1, gone: 2, failed: 1 },
      labelOps: { done: 0, skipped: 0, failed: 0 },
    });
    // Messages with the same change are written together.
    expect(mailbox.batchModify.mock.calls).toEqual([
      [["w1", "w2"], ["Label_2"], []],
      [["r1"], [], ["Label_2"]],
    ]);
    const [running, done] = reports();
    expect(running).toEqual({ status: "running" });
    expect(done.status).toBe("done");
    expect(done.changes).toEqual(
      expect.arrayContaining([
        { gmailId: "w1", status: "written" },
        { gmailId: "w2", status: "written" },
        { gmailId: "r1", status: "written" },
        { gmailId: "u1", status: "unchanged" },
        { gmailId: "c1", status: "changed" },
        { gmailId: "g1", status: "gone" },
        { gmailId: "t1", status: "gone" },
        { gmailId: "f1", status: "failed" },
      ]),
    );
    // Minerva hears of each: the changed one as Gmail has it, the written
    // as written, the gone as deleted.
    const byId = (id: string) =>
      published.filter((p) => p.body.gmailId === id).map((p) => p.key);
    expect(byId("c1")).toEqual(["message.labels"]);
    expect(byId("w1")).toEqual(["message.labels"]);
    expect(byId("g1")).toEqual(["message.delete"]);
    expect(published.find((p) => p.body.gmailId === "c1")?.body.labels).toEqual(
      ["Bills"],
    );
    expect(published.find((p) => p.body.gmailId === "w1")?.body).toMatchObject({
      accountId: ACCOUNT_ID,
      labels: ["Accounts/A", "Travel"],
      flags: { inbox: true },
    });
    expect(published.find((p) => p.body.gmailId === "r1")?.body.labels).toEqual(
      ["Accounts/A"],
    );
    expect(byId("u1")).toEqual([]);
  });

  it("archives and marks read with the labels, and only guards the user's labels", async () => {
    const { writer, open, mailbox, published, reports } = setup();
    const INBOX = { name: "INBOX", gmailLabelId: "INBOX" };
    const UNREAD = { name: "UNREAD", gmailLabelId: "UNREAD" };

    const report = await writer.write(
      request([
        change("i1", [TRAVEL], [INBOX, UNREAD]),
        change("i2", [TRAVEL], [INBOX, UNREAD]),
        change("i3", [TRAVEL], [INBOX, UNREAD]),
        // Flags alone: archive, labels unchanged.
        change("w1", [], [INBOX]),
      ]),
      open,
    );

    expect(report.counts).toEqual({
      written: 2,
      unchanged: 1,
      changed: 1,
      gone: 0,
      failed: 0,
    });
    expect(mailbox.batchModify.mock.calls).toEqual([
      [["i1"], ["Label_2"], ["INBOX", "UNREAD"]],
      [["w1"], [], ["INBOX"]],
    ]);
    expect(reports().at(-1)?.changes).toEqual(
      expect.arrayContaining([
        { gmailId: "i1", status: "written" },
        { gmailId: "i2", status: "unchanged" },
        { gmailId: "i3", status: "changed" },
        { gmailId: "w1", status: "written" },
      ]),
    );
    // Minerva hears the message is out of the inbox and read.
    expect(published.find((p) => p.body.gmailId === "i1")?.body).toMatchObject({
      labels: ["Accounts/A", "Travel"],
      flags: { inbox: false, unread: false },
    });
  });

  it("stars a message, as a flag", async () => {
    const { writer, open, mailbox, published, reports } = setup();
    const STARRED = { name: "STARRED", gmailLabelId: "STARRED" };

    await writer.write(request([change("w1", [STARRED], [])]), open);

    expect(mailbox.batchModify.mock.calls).toEqual([[["w1"], ["STARRED"], []]]);
    expect(reports().at(-1)?.changes).toEqual([
      { gmailId: "w1", status: "written" },
    ]);
    expect(published.find((p) => p.body.gmailId === "w1")?.body).toMatchObject({
      flags: { starred: true },
    });
  });

  it("renames and creates first, writes the messages, then deletes what is empty", async () => {
    const { writer, open, mailbox, calls, reports, published } = setup();
    // w1 has Accounts/A, renamed by the batch to Accounts/Z; it gains a
    // label the batch creates, and loses nothing. Bills (Label_3) still
    // has mail, so stays; Travel is emptied and goes.
    const report = await writer.write(
      {
        ...request([
          {
            gmailId: "w1",
            expected: ["Accounts/A"],
            add: [{ name: "Trips/New" }],
            remove: [],
          },
        ]),
        labelOps: [
          {
            op: "rename",
            name: "Accounts/A",
            newName: "Accounts/Z",
            gmailLabelId: "Label_1",
          },
          { op: "create", name: "Trips/New" },
          { op: "delete", name: "Travel", gmailLabelId: "Label_2" },
          { op: "delete", name: "Bills", gmailLabelId: "Label_3" },
        ],
      },
      open,
    );

    expect(calls).toEqual([
      "create Trips/New",
      "rename Label_1 Accounts/Z",
      "batchModify",
      "delete Label_2",
    ]);
    expect(mailbox.batchModify).toHaveBeenCalledWith(
      ["w1"],
      ["Label_new_Trips/New"],
      [],
    );
    expect(report).toMatchObject({
      status: "done",
      counts: { written: 1 },
      labelOps: { done: 3, skipped: 1, failed: 0 },
    });
    const [, before, after] = reports();
    // Creates and renames are reported before any message is written.
    expect(before).toEqual({
      status: "running",
      changes: [],
      labelOps: [
        {
          op: "create",
          name: "Trips/New",
          status: "done",
          gmailLabelId: "Label_new_Trips/New",
        },
        { op: "rename", name: "Accounts/A", status: "done" },
      ],
    });
    expect(after).toEqual({
      status: "done",
      changes: [{ gmailId: "w1", status: "written" }],
      labelOps: [
        { op: "delete", name: "Travel", status: "done" },
        {
          op: "delete",
          name: "Bills",
          status: "skipped",
          detail: "Still has 4 messages in Gmail",
        },
      ],
    });
    // Minerva hears of the message under the new names.
    expect(published[0].body.labels).toEqual(["Accounts/Z", "Trips/New"]);
  });

  it("fails a rename onto a name Gmail has", async () => {
    const { writer, open, mailbox, reports } = setup();
    await writer.write(
      {
        ...request([]),
        labelOps: [{ op: "rename", name: "Accounts/A", newName: "Travel" }],
      },
      open,
    );
    expect(mailbox.renameLabel).not.toHaveBeenCalled();
    expect(reports()[1].labelOps).toEqual([
      {
        op: "rename",
        name: "Accounts/A",
        status: "failed",
        detail: "Gmail has a label Travel already",
      },
    ]);
  });

  it("reports a change Gmail refuses as failed", async () => {
    const { writer, open, reports } = setup({ refuse: true });

    const report = await writer.write(request([change("w1")]), open);

    expect(report.counts).toMatchObject({ written: 0, failed: 1 });
    expect(reports().at(-1)).toEqual({
      status: "done",
      changes: [{ gmailId: "w1", status: "failed" }],
    });
  });

  it("fails the batch for a mailbox linked for reading only, touching nothing", async () => {
    const { writer, open, mailbox, reports } = setup({
      scope: "openid email https://www.googleapis.com/auth/gmail.readonly",
    });

    const report = await writer.write(request(), open);

    expect(report.status).toBe("failed");
    expect(report.error).toMatch(/reading only/);
    expect(open).not.toHaveBeenCalled();
    expect(mailbox.batchModify).not.toHaveBeenCalled();
    expect(reports().at(-1)).toMatchObject({ status: "failed" });
  });

  it("reports outcomes a few hundred at a time on a large batch", async () => {
    const { writer, open, reports } = setup();
    const many = Array.from({ length: 1200 }, (_, i) =>
      change(`${(0xa000 + i).toString(16)}`),
    );

    await writer.write(request(many), open);

    const sizes = reports().map(
      (r) => (r.changes as unknown[] | undefined)?.length ?? 0,
    );
    expect(sizes).toEqual([0, 500, 500, 200]);
  });

  it("queues batches one after another", async () => {
    const { writer, mailbox } = setup();
    const write = vi.spyOn(writer, "write").mockImplementation(async (r) => ({
      batchId: r.batchId,
      status: "done",
      counts: { written: 0, unchanged: 0, changed: 0, gone: 0, failed: 0 },
      labelOps: { done: 0, skipped: 0, failed: 0 },
    }));

    expect(writer.accept(request([change("a1")]))).toBe(1);
    expect(writer.accept(request([change("a2"), change("b1")]))).toBe(2);
    await writer.idle();

    expect(write).toHaveBeenCalledTimes(2);
    expect(mailbox.batchModify).not.toHaveBeenCalled();
  });

  it.each([
    ["no batch ID", { ...request(), batchId: "b" }],
    ["no changes", request([])],
    [
      "a label without its Gmail ID",
      request([change("w1", [{ name: "Travel", gmailLabelId: "" }])]),
    ],
    ["a change that changes nothing", request([change("w1", [], [])])],
  ])("refuses a batch with %s", (_case, body) => {
    const { writer } = setup();
    expect(() => writer.accept(body)).toThrow(BadRequestException);
  });

  it("is off unless MAIL_WRITES_ENABLED", () => {
    expect(setup({ writes: false }).writer.enabled).toBe(false);
    expect(setup().writer.enabled).toBe(true);
  });
});
