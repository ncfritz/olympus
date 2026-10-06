import type { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import type { MailApi } from "@ncfritz/olympus-client";
import { describe, expect, it, vi } from "vitest";
import type { ClassifierClient } from "../../../src/classifier/ClassifierClient";
import type {
  GmailClient,
  GmailHistoryRecord,
  GmailLabelInfo,
  GmailMailbox,
} from "../../../src/gmail/GmailClient";
import { GmailMessages } from "../../../src/gmail/GmailMessages";
import { GmailPoll } from "../../../src/gmail/GmailPoll";
import type { GmailReconcile } from "../../../src/gmail/GmailReconcile";

/* A synthetic mailbox (never real mail) and its history since the last poll. */
const ACCOUNT_ID = "3f0c8d4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const ACCOUNT = {
  id: ACCOUNT_ID,
  email: "owner@example.net",
  historyId: "100",
};

const LABELS: GmailLabelInfo[] = [
  { id: "INBOX", name: "INBOX", type: "system" },
  { id: "UNREAD", name: "UNREAD", type: "system" },
  { id: "STARRED", name: "STARRED", type: "system" },
  { id: "TRASH", name: "TRASH", type: "system" },
  { id: "DRAFT", name: "DRAFT", type: "system" },
  { id: "CATEGORY_UPDATES", name: "CATEGORY_UPDATES", type: "system" },
  { id: "Label_1", name: "Accounts/A", type: "user" },
  { id: "Label_2", name: "Travel", type: "user" },
];
/** A label made in Gmail since the labels were last read. */
const NEW_LABEL: GmailLabelInfo = { id: "Label_3", name: "New", type: "user" };

const msg = (id: string, labelIds: string[] = []) => ({ id, labelIds });

const HISTORY: GmailHistoryRecord[] = [
  // New mail, fetched whole.
  { id: "101", messagesAdded: [{ message: msg("n1", ["INBOX", "UNREAD"]) }] },
  // A draft saved: not mail Minerva keeps.
  { id: "102", messagesAdded: [{ message: msg("d1", ["DRAFT"]) }] },
  // Deleted for good.
  { id: "103", messagesDeleted: [{ message: msg("x1", ["INBOX"]) }] },
  // Labelled with a label made since: read again, synced, relabelled.
  {
    id: "104",
    labelsAdded: [{ message: msg("a1"), labelIds: ["Label_3"] }],
  },
  // Moved to Trash: deleted from Minerva.
  { id: "105", labelsAdded: [{ message: msg("t1"), labelIds: ["TRASH"] }] },
  // Out of Trash: fetched whole again.
  { id: "106", labelsRemoved: [{ message: msg("r1"), labelIds: ["TRASH"] }] },
  // Labelled, then deleted before the poll: 404.
  { id: "107", labelsAdded: [{ message: msg("g1"), labelIds: ["Label_1"] }] },
];

const CURRENT: Record<string, string[]> = {
  a1: ["Label_3", "Label_1", "CATEGORY_UPDATES"],
  t1: ["TRASH", "Label_1"],
  s1: ["STARRED", "Label_1"],
  s2: ["Label_1"],
};

const rawOf = (id: string, labelIds: string[]) => ({
  id,
  threadId: `t-${id}`,
  labelIds,
  internalDate: String(Date.parse("2026-10-06T19:00:00Z")),
  raw: Buffer.from(
    [
      "From: Example Sender <sender@example.com>",
      "To: owner@example.net",
      `Subject: Message ${id}`,
      "Date: Tue, 6 Oct 2026 19:00:00 +0000",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Synthetic body.",
      "",
    ].join("\r\n"),
  ).toString("base64url"),
});

const notFound = () =>
  Object.assign(new Error("status 404"), { response: { status: 404 } });

const setup = (
  options: {
    history?: GmailHistoryRecord[] | Error;
    historyId?: string;
    rawFails?: string;
  } = {},
) => {
  const published: { key: string; body: Record<string, unknown> }[] = [];
  const amqp = {
    publish: vi.fn(async (_exchange: string, key: string, body: never) => {
      published.push({ key, body });
    }),
  };
  const classifier = {
    configured: true,
    putFeatures: vi.fn(async (_id: string, messages: unknown[]) => ({
      version: "v1",
      stored: messages.length,
    })),
  };
  const mail = {
    listMailSyncAccounts: vi.fn(async () => [ACCOUNT]),
    syncMailLabels: vi.fn(async () => ({
      matched: 7,
      created: 1,
      notInGmail: [],
    })),
    updateMailAccountSync: vi.fn(async () => ({})),
  };
  const mailbox = {
    requests: 9,
    history: vi.fn(async () => {
      if (options.history instanceof Error) throw options.history;
      return {
        historyId: options.historyId ?? "200",
        records: options.history ?? HISTORY,
      };
    }),
    labels: vi.fn(async () => [...LABELS, NEW_LABEL]),
    messageIds: vi.fn(async (_label?: string, query?: string) =>
      query === "has:green-check" ? ["s1"] : [],
    ),
    profile: vi.fn(async () => ({
      emailAddress: ACCOUNT.email,
      messagesTotal: 10,
      threadsTotal: 8,
      historyId: "200",
    })),
    minimal: vi.fn(async (id: string) => {
      if (!CURRENT[id]) throw notFound();
      return { id, labelIds: CURRENT[id] };
    }),
    raw: vi.fn(async (id: string) => {
      if (id === options.rawFails) throw new Error("status 500");
      return rawOf(id, id === "r1" ? ["Label_2"] : ["INBOX", "UNREAD"]);
    }),
  };
  const reconcile = {
    run: vi.fn(async () => ({
      historyId: "300",
      added: 2,
      relabelled: 1,
      deleted: 0,
      featurized: 2,
      featurizeFailed: 0,
      failed: 0,
      gmail: { requests: 2190 },
    })),
  };
  const poll = new GmailPoll(
    mail as unknown as MailApi,
    {} as GmailClient,
    new GmailMessages(
      amqp as unknown as AmqpConnection,
      classifier as unknown as ClassifierClient,
    ),
    reconcile as unknown as GmailReconcile,
  );
  const open = vi.fn(() => mailbox as unknown as GmailMailbox);
  return { poll, open, mail, mailbox, reconcile, published, classifier };
};

describe("GmailPoll", () => {
  it("brings each message history names up to date, then records the historyId", async () => {
    const { poll, open, mail, mailbox, published, classifier } = setup();

    const report = await poll.pollAccount(ACCOUNT, open);

    expect(report).toEqual({
      accountId: ACCOUNT_ID,
      outcome: "polled",
      historyId: "200",
      records: 7,
      added: 2,
      relabelled: 1,
      deleted: 3,
      featurized: 2,
      featurizeFailed: 0,
      failed: 0,
      requests: 9,
    });
    expect(mailbox.history).toHaveBeenCalledWith("100");
    expect(published.map((p) => [p.key, p.body.gmailId])).toEqual([
      ["message.delete", "x1"],
      ["message.upsert", "n1"],
      ["message.upsert", "r1"],
      ["message.labels", "a1"],
      ["message.delete", "t1"],
      ["message.delete", "g1"],
    ]);
    // The new label was read and given to Minerva before it was used.
    expect(mail.syncMailLabels).toHaveBeenCalledWith(
      ACCOUNT_ID,
      expect.arrayContaining([
        { gmailLabelId: "Label_3", name: "New", type: "user" },
      ]),
    );
    expect(published[3].body).toMatchObject({
      labels: ["Accounts/A", "New"],
      categories: ["updates"],
      flags: { inbox: false, unread: false },
    });
    expect(published[1].body).toMatchObject({
      source: "gmail",
      flags: { inbox: true, unread: true },
    });
    expect(published[2].body).toMatchObject({ labels: ["Travel"] });
    // Drafts are never fetched.
    expect(mailbox.raw).not.toHaveBeenCalledWith("d1");
    expect(classifier.putFeatures).toHaveBeenCalledTimes(1);
    expect(mail.updateMailAccountSync).toHaveBeenCalledWith(ACCOUNT_ID, {
      historyId: "200",
      messagesTotal: 10,
      threadsTotal: 8,
    });
  });

  it("reads which icon a star has only when a star was given or taken", async () => {
    const plain = setup();
    await plain.poll.pollAccount(ACCOUNT, plain.open);
    expect(plain.mailbox.messageIds).not.toHaveBeenCalled();
    // Without the icons read, a labels message keeps the recorded icon.
    expect(
      plain.published.find((p) => p.key === "message.labels")?.body,
    ).not.toHaveProperty("starIcon");

    const { poll, open, mailbox, published } = setup({
      history: [
        {
          id: "101",
          labelsAdded: [{ message: msg("s1"), labelIds: ["STARRED"] }],
        },
        {
          id: "102",
          labelsRemoved: [{ message: msg("s2"), labelIds: ["STARRED"] }],
        },
      ],
    });

    await poll.pollAccount(ACCOUNT, open);

    expect(mailbox.messageIds).toHaveBeenCalledTimes(12);
    expect(mailbox.messageIds).toHaveBeenCalledWith(undefined, "has:red-bang");
    expect(published.map((p) => [p.body.gmailId, p.body.starIcon])).toEqual([
      ["s1", "green-check"],
      ["s2", null],
    ]);
  });

  it("does nothing more when history has not moved", async () => {
    const { poll, open, mail, mailbox, published } = setup({
      history: [],
      historyId: "100",
    });

    const report = await poll.pollAccount(ACCOUNT, open);

    expect(report).toMatchObject({ outcome: "unchanged", records: 0 });
    expect(mailbox.profile).not.toHaveBeenCalled();
    expect(mail.updateMailAccountSync).not.toHaveBeenCalled();
    expect(published).toEqual([]);
  });

  it("records a moved historyId even when nothing Minerva keeps changed", async () => {
    const { poll, open, mail, mailbox, published } = setup({
      history: [
        { id: "101", messagesAdded: [{ message: msg("d2", ["DRAFT"]) }] },
      ],
    });

    const report = await poll.pollAccount(ACCOUNT, open);

    expect(report).toMatchObject({ outcome: "polled", added: 0 });
    expect(mailbox.labels).not.toHaveBeenCalled();
    expect(published).toEqual([]);
    expect(mail.updateMailAccountSync).toHaveBeenCalledWith(
      ACCOUNT_ID,
      expect.objectContaining({ historyId: "200" }),
    );
  });

  it("keeps the historyId when a message could not be brought up to date", async () => {
    const { poll, open, mail } = setup({ rawFails: "n1" });

    const report = await poll.pollAccount(ACCOUNT, open);

    expect(report).toMatchObject({ outcome: "polled", added: 1, failed: 1 });
    expect(mail.updateMailAccountSync).not.toHaveBeenCalled();
  });

  it("reconciles when Gmail no longer has the history, at most hourly", async () => {
    const { poll, open, reconcile } = setup({ history: notFound() });

    const first = await poll.pollAccount(ACCOUNT, open);
    const second = await poll.pollAccount(ACCOUNT, open);

    expect(first).toMatchObject({
      outcome: "reconciled",
      historyId: "300",
      added: 2,
      requests: 2190,
    });
    expect(second.outcome).toBe("waiting");
    expect(reconcile.run).toHaveBeenCalledTimes(1);
    expect(reconcile.run).toHaveBeenCalledWith(ACCOUNT.email);
  });

  it("reconciles a mailbox that has never been", async () => {
    const { poll, open, reconcile, mailbox } = setup();

    const report = await poll.pollAccount(
      { id: ACCOUNT_ID, email: ACCOUNT.email },
      open,
    );

    expect(report.outcome).toBe("reconciled");
    expect(reconcile.run).toHaveBeenCalledTimes(1);
    expect(mailbox.history).not.toHaveBeenCalled();
  });

  it("passes over a mailbox this agent holds no credential for", async () => {
    const { poll, mail } = setup();
    const open = vi.fn(() => {
      throw new Error("not linked");
    });

    const report = await poll.pollAccount(ACCOUNT, open);

    expect(report.outcome).toBe("not-linked");
    expect(mail.updateMailAccountSync).not.toHaveBeenCalled();
  });

  it("reports a failed poll without throwing", async () => {
    const { poll, open } = setup({ history: new Error("status 500") });

    const report = await poll.pollAccount(ACCOUNT, open);

    expect(report).toMatchObject({ outcome: "failed", failed: 1, requests: 9 });
  });
});
