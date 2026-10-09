import type { MailApi } from "@ncfritz/olympus-client";
import { describe, expect, it, vi } from "vitest";
import type { ClassifierClient } from "../../../src/classifier/ClassifierClient";
import type { GmailClient, GmailMailbox } from "../../../src/gmail/GmailClient";
import {
  EMBED_MISSING_LIMIT,
  GmailEmbedMissing,
} from "../../../src/gmail/GmailEmbedMissing";

const ACCOUNTS = [
  { id: "7b2b0000-0000-4000-8000-000000000001", email: "someone@example.test" },
  { id: "7b2b0000-0000-4000-8000-000000000002", email: "other@example.test" },
];

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
  options: {
    missing?: Record<string, string[]>;
    noModel?: boolean;
    modelDown?: boolean;
    configured?: boolean;
  } = {},
) => {
  const missing = options.missing ?? {
    [ACCOUNTS[0].id]: ["a1", "gone", "a2"],
    [ACCOUNTS[1].id]: [],
  };
  const mail = { listMailSyncAccounts: vi.fn(async () => ACCOUNTS) };
  const mailbox = {
    requests: 3,
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
  const classifier = {
    configured: options.configured ?? true,
    listMissingEmbeddings: vi.fn(async (accountId: string) =>
      options.noModel
        ? undefined
        : {
            version: "nomic-embed-text-384",
            missing: missing[accountId]?.length ?? 0,
            gmailIds: missing[accountId] ?? [],
          },
    ),
    putEmbeddings: vi.fn(async (_id: string, sent: unknown[]) => {
      if (options.modelDown) throw new Error("Ollama is unreachable");
      return { version: "nomic-embed-text-384", stored: sent.length };
    }),
  };
  const backstop = new GmailEmbedMissing(
    mail as unknown as MailApi,
    {} as GmailClient,
    classifier as unknown as ClassifierClient,
  );
  const open = vi.fn(() => mailbox as unknown as GmailMailbox);
  const run = (email?: string, limit?: number) =>
    backstop.run(email, { limit, open });
  return { run, mailbox, classifier, open };
};

describe("GmailEmbedMissing", () => {
  it("reads what each mailbox is missing again and sends it to be embedded", async () => {
    const { run, classifier, open } = setup();

    const reports = await run();

    expect(classifier.listMissingEmbeddings).toHaveBeenCalledWith(
      ACCOUNTS[0].id,
      EMBED_MISSING_LIMIT,
    );
    expect(reports).toEqual([
      expect.objectContaining({
        accountId: ACCOUNTS[0].id,
        version: "nomic-embed-text-384",
        missing: 3,
        read: 2,
        embedded: 2,
        gone: 1,
        failed: 0,
        requests: 3,
      }),
      expect.objectContaining({
        accountId: ACCOUNTS[1].id,
        missing: 0,
        read: 0,
      }),
    ]);
    const [accountId, sent] = classifier.putEmbeddings.mock.calls[0];
    expect(accountId).toBe(ACCOUNTS[0].id);
    expect(sent.map((m: { gmailId: string }) => m.gmailId)).toEqual([
      "a1",
      "a2",
    ]);
    expect(sent[0]).toMatchObject({ subject: "Your trip" });
    // A mailbox missing nothing is not opened.
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("does one mailbox when named, with the limit asked for", async () => {
    const { run, classifier } = setup();

    const reports = await run(" Someone@Example.test ", 50);

    expect(reports.map((r) => r.email)).toEqual([ACCOUNTS[0].email]);
    expect(classifier.listMissingEmbeddings).toHaveBeenCalledWith(
      ACCOUNTS[0].id,
      50,
    );
    await expect(run("nobody@example.test")).rejects.toThrow(/No mail account/);
  });

  it("stops a mailbox when the model fails, and says so", async () => {
    const { run, mailbox } = setup({
      modelDown: true,
      missing: {
        [ACCOUNTS[0].id]: Array.from({ length: 450 }, (_, i) => `m${i}`),
      },
    });

    const [report] = await run(ACCOUNTS[0].email);

    // The first batch failed; the rest was not read.
    expect(report.failed).toBe(200);
    expect(report.embedded).toBe(0);
    expect(mailbox.raw).toHaveBeenCalledTimes(200);
  });

  it("does nothing without an embedding model, and needs the classifier", async () => {
    const { run, classifier } = setup({ noModel: true });
    const reports = await run();
    expect(reports.every((r) => r.version === null && r.read === 0)).toBe(true);
    expect(classifier.putEmbeddings).not.toHaveBeenCalled();

    await expect(setup({ configured: false }).run()).rejects.toThrow(
      /MAIL_ML_URL/,
    );
  });
});
