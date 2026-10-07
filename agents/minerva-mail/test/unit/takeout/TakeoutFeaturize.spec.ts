import type { MailApi } from "@ncfritz/olympus-client";
import { describe, expect, it, vi } from "vitest";
import type {
  ClassifierClient,
  ClassifierMessage,
} from "../../../src/classifier/ClassifierClient";
import { MboxReader } from "../../../src/sources/takeout/MboxReader";
import { TakeoutParser } from "../../../src/sources/takeout/TakeoutParser";
import {
  FEATURIZE_BATCH,
  TakeoutFeaturize,
} from "../../../src/takeout/TakeoutFeaturize";
import { mbox, message, writeMbox } from "../../support/mbox";

const ACCOUNT_ID = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";

const setup = () => {
  const batches: ClassifierMessage[][] = [];
  const classifier = {
    putFeatures: vi.fn(
      async (_account: string, messages: ClassifierMessage[]) => {
        batches.push(messages);
        return { version: "v1", stored: messages.length };
      },
    ),
    completeFeatures: vi.fn(async (version: string) => ({ version })),
    listFeatureVersions: vi.fn(async () => [
      { version: "v0", status: "ready" },
      { version: "v1", status: "building" },
    ]),
    putEmbeddings: vi.fn(
      async (_account: string, messages: ClassifierMessage[]) => {
        batches.push(messages);
        return { version: "nomic-embed-text-384", stored: messages.length };
      },
    ),
    completeEmbeddings: vi.fn(async (version: string) => ({ version })),
    listEmbeddingVersions: vi.fn(async () => [
      { version: "nomic-embed-text-384", status: "building" },
    ]),
  };
  const mail = {
    importMailAccount: vi.fn(async (email: string) => ({
      id: ACCOUNT_ID,
      email,
      verification: "import",
      verifiedTime: null,
    })),
  };
  const featurize = new TakeoutFeaturize(
    classifier as unknown as ClassifierClient,
    mail as unknown as MailApi,
    new MboxReader(),
    new TakeoutParser(),
  );
  return { featurize, classifier, mail, batches };
};

const archive = (extra: string[] = []) =>
  writeMbox(
    mbox(
      message({
        id: "1",
        labels: "Archived,Accounts/A",
        headers: [
          "From: Power <bill@power.example>",
          "Subject: Your bill",
          "List-Unsubscribe: <mailto:u@power.example>",
          "Content-Type: text/plain; charset=utf-8",
        ],
        body: "Your bill is due.\n",
      }),
      message({ id: "2", labels: "Archived,Opened,Chat" }),
      message({ id: "3", labels: "Trash" }),
      message({ id: "4", thread: null }),
      ...extra,
    ),
  );

describe("TakeoutFeaturize", () => {
  it("sends each kept message's text and headers to the classifier", async () => {
    const { featurize, batches, classifier } = setup();

    const report = await featurize.run(archive(), {
      account: "owner@example.net",
      owner: "neil@example.net",
    });

    expect(report).toMatchObject({
      accountId: ACCOUNT_ID,
      version: "v1",
      messages: 4,
      featurized: 1,
      batches: 1,
      skipped: { chat: 1, trash: 1, spam: 0, draft: 0 },
      failed: { "no-thread-id": 1 },
      nextOffset: null,
      completed: true,
    });
    expect(batches[0]).toEqual([
      {
        gmailId: "1",
        receivedAt: expect.any(String),
        subject: "Your bill",
        text: expect.stringContaining("Your bill is due."),
        fromAddress: "bill@power.example",
        listId: null,
        hasListUnsubscribe: true,
        attachmentExtensions: [],
      },
    ]);
    expect(classifier.putFeatures.mock.calls[0][0]).toBe(ACCOUNT_ID);
    expect(classifier.completeFeatures).toHaveBeenCalledWith("v1");
    // The report is counts: no text in it.
    expect(JSON.stringify(report)).not.toMatch(/bill/i);
  });

  it("embeds instead, completing the embedding version, with --embed", async () => {
    const { featurize, batches, classifier } = setup();

    const report = await featurize.run(archive(), {
      account: "owner@example.net",
      owner: "neil@example.net",
      embed: true,
    });

    expect(report).toMatchObject({
      version: "nomic-embed-text-384",
      featurized: 1,
      completed: true,
    });
    expect(batches[0][0]).toMatchObject({ gmailId: "1", subject: "Your bill" });
    expect(classifier.putFeatures).not.toHaveBeenCalled();
    expect(classifier.completeFeatures).not.toHaveBeenCalled();
    expect(classifier.completeEmbeddings).toHaveBeenCalledWith(
      "nomic-embed-text-384",
    );
  });

  it(`sends batches of ${FEATURIZE_BATCH}`, async () => {
    const { featurize, batches } = setup();
    const many = Array.from({ length: FEATURIZE_BATCH + 5 }, (_, i) =>
      message({ id: String(100 + i) }),
    );

    const report = await featurize.run(writeMbox(mbox(...many)), {
      account: "a@example.net",
      owner: "o@example.net",
    });

    expect(batches.map((b) => b.length)).toEqual([FEATURIZE_BATCH, 5]);
    expect(report.featurized).toBe(FEATURIZE_BATCH + 5);
  });

  it("does not complete the version when it stops early, or is told not to", async () => {
    const early = setup();
    const head = await early.featurize.run(archive(), {
      account: "a@example.net",
      owner: "o@example.net",
      limit: 1,
    });
    expect(head.nextOffset).not.toBeNull();
    expect(head.completed).toBe(false);
    expect(early.classifier.completeFeatures).not.toHaveBeenCalled();

    const told = setup();
    const whole = await told.featurize.run(archive(), {
      account: "a@example.net",
      owner: "o@example.net",
      complete: false,
    });
    expect(whole.nextOffset).toBeNull();
    expect(whole.completed).toBe(false);
    expect(told.classifier.completeFeatures).not.toHaveBeenCalled();
  });

  it("resumes from the offset it reports", async () => {
    const path = archive();
    const first = await setup().featurize.run(path, {
      account: "a@example.net",
      owner: "o@example.net",
      limit: 2,
    });
    const rest = setup();
    const second = await rest.featurize.run(path, {
      account: "a@example.net",
      owner: "o@example.net",
      offset: first.nextOffset!,
    });
    expect(first.messages + second.messages).toBe(4);
    // The last slice sent nothing, but completes the version still building.
    expect(second.featurized).toBe(0);
    expect(second.completed).toBe(true);
    expect(rest.classifier.completeFeatures).toHaveBeenCalledWith("v1");
  });

  it("stops before featurizing when the account cannot be imported", async () => {
    const { featurize, mail, classifier } = setup();
    mail.importMailAccount.mockRejectedValueOnce(new Error("409"));
    await expect(
      featurize.run(archive(), {
        account: "a@example.net",
        owner: "o@example.net",
      }),
    ).rejects.toThrow("409");
    expect(classifier.putFeatures).not.toHaveBeenCalled();
  });
});
