import type { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import type { MailApi } from "@ncfritz/olympus-client";
import { describe, expect, it, vi } from "vitest";
import type {
  GmailClient,
  GmailLabelInfo,
  GmailMailbox,
} from "../../../src/gmail/GmailClient";
import { GmailReconcile } from "../../../src/gmail/GmailReconcile";

/*
 * A synthetic mailbox (never real mail): Minerva has a, b, c and d from the
 * archive; Gmail has a unchanged, b relabelled and read, c deleted, d as a
 * draft (left out, so deleted), and e new since the archive.
 */
const ACCOUNT_ID = "3f0c8d4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const EMAIL = "owner@example.net";

const LABELS: GmailLabelInfo[] = [
  { id: "INBOX", name: "INBOX", type: "system" },
  { id: "UNREAD", name: "UNREAD", type: "system" },
  { id: "DRAFT", name: "DRAFT", type: "system" },
  { id: "TRASH", name: "TRASH", type: "system" },
  { id: "CATEGORY_UPDATES", name: "CATEGORY_UPDATES", type: "system" },
  { id: "Label_1", name: "Accounts/A", type: "user" },
  { id: "Label_2", name: "Travel", type: "user" },
];

const BY_LABEL: Record<string, string[]> = {
  "": ["a", "b", "d", "e"],
  INBOX: ["a", "e"],
  UNREAD: ["a", "e"],
  DRAFT: ["d"],
  CATEGORY_UPDATES: ["a", "b"],
  Label_1: ["a"],
  Label_2: ["b", "e"],
};

const flags = (over: Record<string, boolean> = {}) => ({
  inbox: false,
  unread: false,
  starred: false,
  important: false,
  sent: false,
  ...over,
});

const MINERVA = [
  {
    gmailId: "a",
    labels: ["Accounts/A"],
    categories: ["updates"],
    flags: flags({ inbox: true, unread: true }),
  },
  {
    gmailId: "b",
    labels: ["Accounts/A"],
    categories: ["updates"],
    flags: flags({ unread: true }),
  },
  { gmailId: "c", labels: [], categories: [], flags: flags() },
  { gmailId: "d", labels: [], categories: [], flags: flags() },
];

const RAW = [
  "From: Example Sender <sender@example.com>",
  "To: owner@example.net",
  "Subject: A new message",
  "Date: Mon, 5 Oct 2026 10:00:00 +0000",
  "Message-ID: <e@example.com>",
  "Content-Type: text/plain; charset=utf-8",
  "",
  `${"Only the snippet is published. ".repeat(10)}Past the snippet: never published.`,
  "",
].join("\r\n");

const setup = (options: { rawFails?: boolean; email?: string } = {}) => {
  const published: { key: string; body: Record<string, unknown> }[] = [];
  const amqp = {
    publish: vi.fn(async (_exchange: string, key: string, body: never) => {
      published.push({ key, body });
    }),
  };
  const mail = {
    listMailTrainingAccounts: vi.fn(async () => [
      { id: ACCOUNT_ID, email: EMAIL },
    ]),
    syncMailLabels: vi.fn(async () => ({
      matched: 4,
      created: 1,
      notInGmail: ["Old"],
    })),
    listMailMessageStates: vi.fn(async (_id: string, after?: string) =>
      after
        ? { messages: MINERVA.slice(2) }
        : { messages: MINERVA.slice(0, 2), nextCursor: "b" },
    ),
    updateMailAccountSync: vi.fn(async () => ({})),
  };
  const mailbox = {
    profile: vi.fn(async () => ({
      emailAddress: options.email ?? "Owner@Example.net",
      messagesTotal: 4,
      threadsTotal: 3,
      historyId: "12345",
    })),
    labels: vi.fn(async () => LABELS),
    labelTotals: vi.fn(async (id: string) => {
      if (id === "CHAT") throw new Error("status 404");
      return { messagesTotal: id === "DRAFT" ? 1 : 0, threadsTotal: 0 };
    }),
    messageIds: vi.fn(async (label?: string) => BY_LABEL[label ?? ""] ?? []),
    raw: vi.fn(async (id: string) => {
      if (options.rawFails) throw new Error("status 500");
      return {
        id,
        threadId: "t-e",
        labelIds: ["INBOX", "UNREAD", "Label_2"],
        internalDate: String(Date.parse("2026-10-05T10:00:01Z")),
        raw: Buffer.from(RAW).toString("base64url"),
      };
    }),
  };
  const reconcile = new GmailReconcile(
    amqp as unknown as AmqpConnection,
    mail as unknown as MailApi,
    {} as GmailClient,
  );
  const run = () =>
    reconcile.run(EMAIL, {}, mailbox as unknown as GmailMailbox);
  return { run, mail, mailbox, published };
};

describe("GmailReconcile", () => {
  it("brings Minerva into step with Gmail and records the historyId", async () => {
    const { run, mail, published } = setup();

    const report = await run();

    expect(report).toMatchObject({
      accountId: ACCOUNT_ID,
      historyId: "12345",
      gmail: {
        messagesTotal: 4,
        threadsTotal: 3,
        kept: 3,
        excluded: {
          spam: { messages: 0, threads: 0 },
          trash: { messages: 0, threads: 0 },
          drafts: { messages: 1, threads: 0 },
          chats: null,
        },
      },
      labels: { matched: 4, created: 1, notInGmail: ["Old"] },
      minerva: { messages: 4 },
      unchanged: 1,
      relabelled: 1,
      differences: {
        labels: 1,
        categories: 0,
        flags: { inbox: 0, unread: 1, starred: 0, important: 0, sent: 0 },
      },
      labelChanges: [
        { label: "Accounts/A", added: 0, removed: 1 },
        { label: "Travel", added: 1, removed: 0 },
      ],
      deleted: 2,
      added: 1,
      failed: 0,
    });
    expect(mail.syncMailLabels).toHaveBeenCalledWith(
      ACCOUNT_ID,
      expect.arrayContaining([
        { gmailLabelId: "Label_1", name: "Accounts/A", type: "user" },
      ]),
    );
    expect(published.map((p) => [p.key, p.body.gmailId])).toEqual([
      ["message.labels", "b"],
      ["message.delete", "c"],
      ["message.delete", "d"],
      ["message.upsert", "e"],
    ]);
    expect(published[0].body).toMatchObject({
      accountId: ACCOUNT_ID,
      source: "gmail",
      labels: ["Travel"],
      categories: ["updates"],
      flags: flags(),
    });
    expect(published[3].body).toMatchObject({
      source: "gmail",
      threadId: "t-e",
      subject: "A new message",
      labels: ["Travel"],
      categories: [],
      flags: { inbox: true, unread: true },
    });
    expect(JSON.stringify(published)).not.toContain("Past the snippet");
    expect(mail.updateMailAccountSync).toHaveBeenCalledWith(ACCOUNT_ID, {
      historyId: "12345",
      messagesTotal: 4,
      threadsTotal: 3,
    });
  });

  it("leaves the historyId when a message could not be fetched", async () => {
    const { run, mail } = setup({ rawFails: true });

    const report = await run();

    expect(report).toMatchObject({ added: 0, failed: 1 });
    expect(mail.updateMailAccountSync).not.toHaveBeenCalled();
  });

  it("refuses a credential that reads another mailbox", async () => {
    const { run, mail, published } = setup({ email: "someone@example.org" });

    await expect(run()).rejects.toThrow("reads another mailbox");
    expect(mail.syncMailLabels).not.toHaveBeenCalled();
    expect(published).toEqual([]);
  });
});
