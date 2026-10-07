import type { MailApi } from "@ncfritz/olympus-client";
import { describe, expect, it, vi } from "vitest";
import type { GmailClient, GmailMailbox } from "../../../src/gmail/GmailClient";
import type { GmailMessages } from "../../../src/gmail/GmailMessages";
import { GmailSuggestInbox } from "../../../src/gmail/GmailSuggestInbox";

const ACCOUNT_ID = "7b2b0000-0000-4000-8000-000000000001";
const EMAIL = "someone@example.test";

// Synthetic mail.
const RAW = [
  "From: Example Air <trips@example.test>",
  "To: someone@example.test",
  "Subject: Your trip",
  "Date: Mon, 05 Oct 2026 10:00:00 +0000",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Your booking is confirmed.",
  "",
].join("\r\n");

const notFound = () =>
  Object.assign(new Error("Not Found"), { response: { status: 404 } });

const setup = (
  options: { ids?: string[]; noModel?: boolean; featurizing?: boolean } = {},
) => {
  const mail = {
    listMailSyncAccounts: vi.fn(async () => [
      { id: ACCOUNT_ID, email: EMAIL, historyId: "100" },
    ]),
  };
  const mailbox = {
    requests: 4,
    messageIds: vi.fn(async () => options.ids ?? ["a1", "a2", "gone"]),
    raw: vi.fn(async (id: string) => {
      if (id === "gone") throw notFound();
      return {
        id,
        threadId: `t-${id}`,
        labelIds: ["INBOX"],
        internalDate: String(Date.parse("2026-10-05T10:00:01Z")),
        raw: Buffer.from(RAW).toString("base64url"),
      };
    }),
  };
  const messages = {
    featurizing: options.featurizing ?? true,
    suggest: vi.fn(async (_id: string, sent: unknown[]) =>
      options.noModel ? undefined : sent.length,
    ),
  };
  const inbox = new GmailSuggestInbox(
    mail as unknown as MailApi,
    {} as GmailClient,
    messages as unknown as GmailMessages,
  );
  const run = (email = EMAIL) =>
    inbox.run(email, { open: () => mailbox as unknown as GmailMailbox });
  return { run, mailbox, messages };
};

describe("GmailSuggestInbox", () => {
  it("scores each message in the inbox and counts what it could not read", async () => {
    const { run, mailbox, messages } = setup();

    const report = await run(" Someone@Example.test ");

    expect(mailbox.messageIds).toHaveBeenCalledWith("INBOX");
    expect(report).toMatchObject({
      accountId: ACCOUNT_ID,
      inbox: 3,
      suggested: 2,
      gone: 1,
      failed: 0,
      noModel: false,
      requests: 4,
    });
    const [accountId, sent] = messages.suggest.mock.calls[0];
    expect(accountId).toBe(ACCOUNT_ID);
    expect(sent).toEqual([
      expect.objectContaining({
        gmailId: "a1",
        subject: "Your trip",
        fromAddress: "trips@example.test",
      }),
      expect.objectContaining({ gmailId: "a2" }),
    ]);
  });

  it("stops at the first batch when no model serves the account", async () => {
    const ids = Array.from({ length: 450 }, (_, i) => i.toString(16));
    const { run, mailbox, messages } = setup({ ids, noModel: true });

    const report = await run();

    expect(report).toMatchObject({ inbox: 450, suggested: 0, noModel: true });
    expect(messages.suggest).toHaveBeenCalledTimes(1);
    expect(mailbox.raw.mock.calls.length).toBeLessThan(450);
  });

  it("refuses without the classifier, and for a mailbox not linked", async () => {
    await expect(setup({ featurizing: false }).run()).rejects.toThrow(
      /classifier/,
    );
    await expect(setup().run("other@example.test")).rejects.toThrow(
      /No mail account/,
    );
  });
});
