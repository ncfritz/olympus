import type { MailMetadataMessage } from "@ncfritz/olympus-messages";
import type { ConsumeMessage } from "amqplib";
import { register } from "prom-client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MailMessageHandler } from "../../../src/minerva/mail/handlers/MailMessageHandler";
import { uniqueViolation } from "../../support/signedInApp";
import { createTestApp, type TestApp } from "../../support/testApp";

const QUEUE = "olympus-api.mail-messages";
const DEAD = `${QUEUE}.dead`;
const MESSAGE_ID = "9d4d0000-0000-4000-8000-000000000001";

// The service keeps account and label IDs for the life of the process: each
// test has an account of its own unless it means to share one.
let accounts = 0;
const nextAccount = () =>
  `7b2b0000-0000-4000-8000-${String(++accounts).padStart(12, "0")}`;

const mailMessage = (
  overrides: Partial<MailMetadataMessage> = {},
): MailMetadataMessage => ({
  accountId: "7b2b0000-0000-4000-8000-000000000000",
  source: "takeout",
  snapshotTime: "2026-10-05T23:00:00.000Z",
  gmailId: "1a0fab8f293aa5b5",
  threadId: "1a0fab8f293aa5b4",
  receivedAt: "2026-10-02T03:46:59.000Z",
  sentAt: "2026-10-02T03:46:58.000Z",
  from: { address: "billing@power.example", name: "Power Co" },
  replyTo: [{ address: "help@power.example", name: null }],
  to: [
    { address: "owner@example.test", name: "Owner" },
    { address: "other@example.test", name: null },
  ],
  cc: [],
  deliveredTo: "owner@example.test",
  listId: null,
  hasListUnsubscribe: true,
  messageIdHeader: "<abc@power.example>",
  subject: "Your bill",
  snippet: "Your bill is ready.",
  sizeBytes: 2048,
  labels: ["Bills/*Payable", "Accounts/Utilities/Power"],
  categories: ["updates"],
  flags: {
    inbox: false,
    unread: false,
    starred: true,
    important: false,
    sent: false,
  },
  attachments: [
    {
      mimeType: "application/pdf",
      extension: "pdf",
      sizeBytes: 300,
      inline: false,
    },
  ],
  ...overrides,
});

const delivery = (routingKey: string, headers: Record<string, unknown> = {}) =>
  ({
    fields: { routingKey },
    properties: { headers },
  }) as unknown as ConsumeMessage;

/** How many messages the counter has seen with these labels. */
const consumed = async (action: string, result: string): Promise<number> => {
  const metric = register.getSingleMetric("mail_messages_consumed_total");
  const values = (await metric?.get())?.values ?? [];
  return (
    values.find((v) => v.labels.action === action && v.labels.result === result)
      ?.value ?? 0
  );
};

/**
 * The consumer of the mail agent's message metadata (ADR 0030), its handler
 * called as RabbitMQ would call it, against the API's Hasura stand-in.
 */
describe("Mail messages consumer", () => {
  let t: TestApp;
  let handler: MailMessageHandler;

  beforeAll(async () => {
    t = await createTestApp();
    handler = t.app.get(MailMessageHandler);
  });
  afterAll(async () => t.close());

  /** Labels as Hasura would hand back their IDs: `label:<name>`. */
  const hasura = (options: { account?: boolean; stale?: boolean } = {}) => {
    t.graphql.on("DescribeMailMessageAccount", (vars) => ({
      minerva_mail_accounts_by_pk:
        options.account === false
          ? null
          : { id: (vars as { accountId: string }).accountId },
    }));
    t.graphql.on("EnsureMailLabels", (vars) => ({
      insert_minerva_mail_labels: {
        affected_rows: (vars as { labels: unknown[] }).labels.length,
      },
    }));
    t.graphql.on("ListMailLabelIds", (vars) => ({
      minerva_mail_labels: (vars as { names: string[] }).names.map((name) => ({
        id: `label:${name}`,
        name,
      })),
    }));
    t.graphql.on("WriteMailMessage", {
      insert_minerva_mail_messages_one: options.stale
        ? null
        : { id: MESSAGE_ID },
    });
    t.graphql.on("WriteMailMessageParts", {
      delete_minerva_mail_message_recipients: { affected_rows: 0 },
      delete_minerva_mail_message_attachments: { affected_rows: 0 },
      delete_minerva_mail_message_labels: { affected_rows: 0 },
      insert_minerva_mail_message_recipients: { affected_rows: 3 },
      insert_minerva_mail_message_attachments: { affected_rows: 1 },
      insert_minerva_mail_message_labels: { affected_rows: 3 },
    });
  };

  beforeEach(() => {
    t.reset();
  });

  /** Where the handler sent messages: [queue, message, headers]. */
  const sent = () =>
    t.amqp.publish.mock.calls.map(([exchange, queue, message, options]) => {
      expect(exchange).toBe("");
      expect(options).toMatchObject({ persistent: true });
      return [
        queue,
        message,
        (options as { headers: Record<string, unknown> }).headers,
      ];
    });

  it("subscribes to every action on its own queue, with a dead-letter queue", () => {
    const handle = MailMessageHandler.prototype.handle;
    const config = Reflect.getMetadataKeys(handle)
      .map((key) => Reflect.getMetadata(key, handle))
      .find((value) => value && typeof value === "object" && "queue" in value);
    expect(config).toMatchObject({
      type: "subscribe",
      exchange: "mail.messages",
      routingKey: "message.*",
      queue: QUEUE,
      queueOptions: {
        durable: true,
        channel: "mailMessagesChannel",
        deadLetterExchange: "",
        deadLetterRoutingKey: DEAD,
      },
      errorBehavior: "NACK",
    });
  });

  it("writes the message, then its recipients, attachments and labels", async () => {
    hasura();
    const accountId = nextAccount();
    const before = await consumed("upsert", "written");

    await handler.handle(
      mailMessage({ accountId }),
      delivery("message.upsert"),
    );

    // Labels made the first time they are seen; a category as a system label.
    expect(t.graphql.calls("EnsureMailLabels")[0]?.variables).toEqual({
      labels: [
        { accountId, name: "Bills/*Payable", type: "user" },
        { accountId, name: "Accounts/Utilities/Power", type: "user" },
        { accountId, name: "CATEGORY_UPDATES", type: "system" },
      ],
    });
    const write = t.graphql.calls("WriteMailMessage")[0];
    expect(write?.variables).toEqual({
      message: {
        accountId,
        gmailId: "1a0fab8f293aa5b5",
        threadId: "1a0fab8f293aa5b4",
        source: "takeout",
        snapshotTime: "2026-10-05T23:00:00.000Z",
        receivedTime: "2026-10-02T03:46:59.000Z",
        sentTime: "2026-10-02T03:46:58.000Z",
        fromAddress: "billing@power.example",
        fromName: "Power Co",
        deliveredTo: "owner@example.test",
        listId: null,
        hasListUnsubscribe: true,
        messageIdHeader: "<abc@power.example>",
        subject: "Your bill",
        snippet: "Your bill is ready.",
        sizeBytes: 2048,
        inInbox: false,
        unread: false,
        starred: true,
        important: false,
        sent: false,
      },
      snapshotTime: "2026-10-05T23:00:00.000Z",
    });
    // By account and Gmail ID, never over a newer snapshot.
    expect(write?.document).toContain(
      "constraint: mail_messages_account_id_gmail_id_key",
    );
    expect(write?.document).toMatch(
      /where: \{ snapshotTime: \{ _lte: \$snapshotTime \} \}/,
    );
    expect(t.graphql.calls("WriteMailMessageParts")[0]?.variables).toEqual({
      messageId: MESSAGE_ID,
      recipients: [
        {
          kind: "to",
          position: 0,
          address: "owner@example.test",
          name: "Owner",
          messageId: MESSAGE_ID,
        },
        {
          kind: "to",
          position: 1,
          address: "other@example.test",
          name: null,
          messageId: MESSAGE_ID,
        },
        {
          kind: "reply_to",
          position: 0,
          address: "help@power.example",
          name: null,
          messageId: MESSAGE_ID,
        },
      ],
      attachments: [
        {
          position: 0,
          mimeType: "application/pdf",
          extension: "pdf",
          sizeBytes: 300,
          inline: false,
          messageId: MESSAGE_ID,
        },
      ],
      labels: [
        { messageId: MESSAGE_ID, labelId: "label:Bills/*Payable" },
        { messageId: MESSAGE_ID, labelId: "label:Accounts/Utilities/Power" },
        { messageId: MESSAGE_ID, labelId: "label:CATEGORY_UPDATES" },
      ],
    });
    expect(sent()).toEqual([]);
    expect(await consumed("upsert", "written")).toBe(before + 1);
  });

  it("asks for an account and a label only the first time", async () => {
    hasura();
    const accountId = nextAccount();
    await handler.handle(
      mailMessage({ accountId }),
      delivery("message.upsert"),
    );
    await handler.handle(
      mailMessage({
        accountId,
        gmailId: "2b",
        labels: ["Bills/*Payable", "New"],
      }),
      delivery("message.upsert"),
    );

    expect(t.graphql.calls("DescribeMailMessageAccount")).toHaveLength(1);
    const ensured = t.graphql.calls("EnsureMailLabels");
    expect(ensured).toHaveLength(2);
    expect(ensured[1]?.variables).toEqual({
      labels: [{ accountId, name: "New", type: "user" }],
    });
    expect(
      (
        t.graphql.calls("WriteMailMessageParts")[1]?.variables as {
          labels: unknown[];
        }
      ).labels,
    ).toEqual([
      { messageId: MESSAGE_ID, labelId: "label:Bills/*Payable" },
      { messageId: MESSAGE_ID, labelId: "label:New" },
      { messageId: MESSAGE_ID, labelId: "label:CATEGORY_UPDATES" },
    ]);
  });

  it("skips, and writes no parts for, a message Minerva holds a newer snapshot of", async () => {
    hasura({ stale: true });
    const before = await consumed("upsert", "stale");

    await handler.handle(
      mailMessage({ accountId: nextAccount() }),
      delivery("message.upsert"),
    );

    expect(t.graphql.calls("WriteMailMessageParts")).toHaveLength(0);
    expect(sent()).toEqual([]);
    expect(await consumed("upsert", "stale")).toBe(before + 1);
  });

  it("acknowledges, and writes nothing for, an account that is gone", async () => {
    hasura({ account: false });
    const before = await consumed("upsert", "unknown_account");

    await handler.handle(
      mailMessage({ accountId: nextAccount() }),
      delivery("message.upsert"),
    );

    expect(t.graphql.calls("EnsureMailLabels")).toHaveLength(0);
    expect(t.graphql.calls("WriteMailMessage")).toHaveLength(0);
    expect(sent()).toEqual([]);
    expect(await consumed("upsert", "unknown_account")).toBe(before + 1);
  });

  it.each([
    ["a decimal Gmail ID", { gmailId: "1877908200997168565" }, /gmailId/],
    ["a snippet past 200 characters", { snippet: "é".repeat(201) }, /snippet/],
    [
      "an upper-case sender",
      { from: { address: "A@b.example", name: null } },
      /from/,
    ],
    ["no snapshot time", { snapshotTime: "later" }, /snapshotTime/],
    ["an unknown source", { source: "imap" as never }, /source/],
    ["a padded label", { labels: [" Bills"] }, /labels/],
    [
      "a category that is not a word",
      { categories: ["Category Updates"] },
      /categories/,
    ],
    ["no account", { accountId: "neil" }, /accountId/],
    [
      "a reply-to address past 1,024 characters",
      {
        replyTo: [{ address: `${"t".repeat(1015)}@b.example`, name: null }],
      },
      /replyTo\[0\]/,
    ],
  ])(
    "dead-letters %s with why, before Hasura",
    async (_case, overrides, reason) => {
      hasura();
      const message = mailMessage({ accountId: nextAccount(), ...overrides });

      await handler.handle(message, delivery("message.upsert"));

      expect(t.graphql.calls("DescribeMailMessageAccount")).toHaveLength(0);
      expect(sent()).toEqual([
        [
          DEAD,
          message,
          expect.objectContaining({
            "x-olympus-routing-key": "message.upsert",
            "x-olympus-dead-reason": expect.stringMatching(reason),
          }),
        ],
      ]);
    },
  );

  it("allows a reply-to address longer than RFC 5321's 320 characters", async () => {
    // Bulk mail's tracking addresses run past it; Gmail takes them.
    hasura();
    const replyTo = [{ address: `${"t".repeat(310)}@b.example`, name: null }];
    await handler.handle(
      mailMessage({ accountId: nextAccount(), replyTo }),
      delivery("message.upsert"),
    );
    expect(sent()).toEqual([]);
    expect(t.graphql.calls("WriteMailMessageParts")).toHaveLength(1);
  });

  it("allows a snippet of 200 characters however many bytes", async () => {
    hasura();
    await handler.handle(
      mailMessage({ accountId: nextAccount(), snippet: "é".repeat(200) }),
      delivery("message.upsert"),
    );
    expect(t.graphql.calls("WriteMailMessage")).toHaveLength(1);
  });

  it("dead-letters a message with an unknown routing key", async () => {
    const message = mailMessage({ accountId: nextAccount() });
    await handler.handle(message, delivery("message.purge"));
    expect(sent()).toEqual([
      [
        DEAD,
        message,
        expect.objectContaining({
          "x-olympus-dead-reason": "unknown routing key message.purge",
        }),
      ],
    ]);
  });

  it("dead-letters a message Hasura refuses for its data, without retrying", async () => {
    hasura();
    t.graphql.on("WriteMailMessage", uniqueViolation);
    const message = mailMessage({ accountId: nextAccount() });

    await handler.handle(message, delivery("message.upsert"));

    expect(sent()).toEqual([
      [
        DEAD,
        message,
        expect.objectContaining({
          "x-olympus-dead-reason": expect.stringMatching(/^Hasura refused it/),
        }),
      ],
    ]);
  });

  it("retries through the delay queues while Hasura does not answer", async () => {
    t.graphql.fail("DescribeMailMessageAccount", "fetch failed");
    const message = mailMessage({ accountId: nextAccount() });
    const before = await consumed("upsert", "retried");

    const queues = [];
    for (let failed = 0; failed < 9; failed++) {
      t.amqp.publish.mockClear();
      const headers =
        failed === 0
          ? {}
          : {
              "x-olympus-attempts": failed,
              "x-olympus-routing-key": "message.upsert",
            };
      await handler.handle(
        message,
        delivery(failed === 0 ? "message.upsert" : QUEUE, headers),
      );
      const [[queue, sentMessage, sentHeaders]] = sent();
      expect(sentMessage).toEqual(message);
      expect(sentHeaders).toMatchObject({
        "x-olympus-attempts": failed + 1,
        "x-olympus-routing-key": "message.upsert",
      });
      queues.push(queue);
    }

    expect(queues).toEqual([
      `${QUEUE}.retry.5s`,
      `${QUEUE}.retry.5s`,
      `${QUEUE}.retry.30s`,
      `${QUEUE}.retry.30s`,
      `${QUEUE}.retry.30s`,
      `${QUEUE}.retry.5m`,
      `${QUEUE}.retry.5m`,
      `${QUEUE}.retry.5m`,
      `${QUEUE}.retry.5m`,
    ]);
    expect(await consumed("upsert", "retried")).toBe(before + 9);
  });

  it("dead-letters a message on its tenth failure", async () => {
    t.graphql.fail("DescribeMailMessageAccount", "fetch failed");
    const message = mailMessage({ accountId: nextAccount() });

    await handler.handle(
      message,
      delivery(QUEUE, {
        "x-olympus-attempts": 9,
        "x-olympus-routing-key": "message.upsert",
      }),
    );

    expect(sent()).toEqual([
      [
        DEAD,
        message,
        expect.objectContaining({
          "x-olympus-attempts": 10,
          "x-olympus-dead-reason": expect.stringMatching(
            /^gave up after 10 attempts: .*fetch failed/,
          ),
        }),
      ],
    ]);
  });
});
