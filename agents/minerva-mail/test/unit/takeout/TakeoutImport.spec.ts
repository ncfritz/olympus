import type { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import type { MailApi } from "@ncfritz/olympus-client";
import type { MailMetadataMessage } from "@ncfritz/olympus-messages";
import { describe, expect, it, vi } from "vitest";
import { MboxReader } from "../../../src/sources/takeout/MboxReader";
import { TakeoutParser } from "../../../src/sources/takeout/TakeoutParser";
import { TakeoutImport } from "../../../src/takeout/TakeoutImport";
import { mbox, message, writeMbox } from "../../support/mbox";

const ACCOUNT_ID = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";

const archive = () =>
  writeMbox(
    mbox(
      message({ id: "1", labels: "Archived,Accounts/A,Category Updates" }),
      message({ id: "2", labels: "Inbox,Unread,Accounts/B" }),
      message({ id: "3", labels: "Archived,Opened,Chat" }),
      message({ id: "4", labels: "Trash,Opened" }),
      message({ id: "5", thread: null }),
      message({ id: "6", labels: null }),
    ),
  );

const setup = () => {
  const published: { exchange: string; key: string; body: unknown }[] = [];
  const amqp = {
    publish: vi.fn(async (exchange: string, key: string, body: unknown) => {
      published.push({ exchange, key, body });
      return true;
    }),
  };
  const mail = {
    importMailAccount: vi.fn(async (email: string) => ({
      id: ACCOUNT_ID,
      email,
      verification: "import",
      verifiedTime: null,
    })),
  };
  const importer = new TakeoutImport(
    amqp as unknown as AmqpConnection,
    mail as unknown as MailApi,
    new MboxReader(),
    new TakeoutParser(),
  );
  return { importer, amqp, mail, published };
};

describe("TakeoutImport", () => {
  it("imports the account, then publishes each kept message's metadata", async () => {
    const { importer, mail, published } = setup();
    const report = await importer.run(archive(), {
      account: "owner@example.net",
      owner: "neil@example.net",
    });

    expect(mail.importMailAccount).toHaveBeenCalledWith(
      "owner@example.net",
      "neil@example.net",
    );
    expect(report).toMatchObject({
      accountId: ACCOUNT_ID,
      messages: 6,
      published: 3,
      skipped: { chat: 1, trash: 1, spam: 0, draft: 0 },
      failed: { "no-thread-id": 1 },
      nextOffset: null,
    });
    expect(published.map((p) => [p.exchange, p.key])).toEqual([
      ["mail.messages", "message.upsert"],
      ["mail.messages", "message.upsert"],
      ["mail.messages", "message.upsert"],
    ]);
    const first = published[0].body as MailMetadataMessage;
    expect(first).toMatchObject({
      accountId: ACCOUNT_ID,
      source: "takeout",
      gmailId: "1",
      labels: ["Accounts/A"],
      categories: ["updates"],
      flags: { inbox: false, unread: false },
    });
    expect((published[1].body as MailMetadataMessage).flags).toMatchObject({
      inbox: true,
      unread: true,
    });
  });

  it("publishes the snippet but never the text", async () => {
    const { importer, published } = setup();
    const long = `${"word ".repeat(60)}SECRET-PAST-THE-SNIPPET\n`;
    const path = writeMbox(mbox(message({ id: "10", body: long })));
    await importer.run(path, { account: "a@example.net", owner: "o@x.net" });
    const body = JSON.stringify(published[0].body);
    expect(body).toContain("word word");
    expect(body).not.toContain("SECRET-PAST-THE-SNIPPET");
    expect(published[0].body).not.toHaveProperty("text");
  });

  it("stops at a limit and resumes from the offset it reports", async () => {
    const path = archive();
    const first = setup();
    const head = await first.importer.run(path, {
      account: "a@example.net",
      owner: "o@x.net",
      limit: 2,
    });
    expect(head.messages).toBe(2);
    expect(head.nextOffset).not.toBeNull();

    const second = setup();
    const tail = await second.importer.run(path, {
      account: "a@example.net",
      owner: "o@x.net",
      offset: head.nextOffset!,
    });
    expect(tail.messages).toBe(4);
    expect(head.published + tail.published).toBe(3);
  });

  it("publishes nothing when the account cannot be imported", async () => {
    const { importer, mail, amqp } = setup();
    mail.importMailAccount.mockRejectedValueOnce(new Error("409"));
    await expect(
      importer.run(archive(), { account: "a@example.net", owner: "o@x.net" }),
    ).rejects.toThrow("409");
    expect(amqp.publish).not.toHaveBeenCalled();
  });
});
