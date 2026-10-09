import { describe, expect, it } from "vitest";
import type { MailSourceMessage } from "../../../src/sources/MailSourceMessage";
import { toMetadataMessage } from "../../../src/takeout/toMetadataMessage";

const source = (): MailSourceMessage =>
  ({
    gmailId: "1a0fab8f293aa5b5",
    threadId: "1a0fab8f293aa5b5",
    receivedAt: "2026-10-02T03:46:59.000Z",
    sentAt: undefined,
    from: { address: "sender@example.com" },
    replyTo: [],
    to: [{ address: "owner@example.net", name: "Owner" }],
    cc: [],
    deliveredTo: undefined,
    listId: undefined,
    hasListUnsubscribe: false,
    messageIdHeader: undefined,
    subject: undefined,
    snippet: "Hello there.",
    text: "Hello there. And the rest, which is never published.",
    sizeBytes: 321,
    labels: ["Accounts/Example"],
    categories: ["updates"],
    flags: {
      inbox: false,
      unread: true,
      starred: false,
      important: false,
      sent: false,
      chat: false,
      trash: false,
      spam: false,
      draft: false,
    },
    attachments: [
      { mimeType: "application/pdf", sizeBytes: 1000, inline: false },
    ],
  }) as MailSourceMessage;

describe("toMetadataMessage", () => {
  const snapshot = new Date("2026-10-05T12:00:00.000Z");

  it("carries the metadata, with nulls for what the message lacks", () => {
    expect(
      toMetadataMessage(source(), "account-1", "takeout", snapshot),
    ).toEqual({
      accountId: "account-1",
      source: "takeout",
      snapshotTime: "2026-10-05T12:00:00.000Z",
      gmailId: "1a0fab8f293aa5b5",
      threadId: "1a0fab8f293aa5b5",
      receivedAt: "2026-10-02T03:46:59.000Z",
      sentAt: null,
      from: { address: "sender@example.com", name: null },
      replyTo: [],
      to: [{ address: "owner@example.net", name: "Owner" }],
      cc: [],
      deliveredTo: null,
      listId: null,
      hasListUnsubscribe: false,
      messageIdHeader: null,
      subject: null,
      snippet: "Hello there.",
      sizeBytes: 321,
      labels: ["Accounts/Example"],
      categories: ["updates"],
      flags: {
        inbox: false,
        unread: true,
        starred: false,
        important: false,
        sent: false,
      },
      attachments: [
        {
          mimeType: "application/pdf",
          extension: null,
          sizeBytes: 1000,
          inline: false,
        },
      ],
    });
  });

  it("leaves the text behind", () => {
    const published = JSON.stringify(
      toMetadataMessage(source(), "account-1", "takeout", snapshot),
    );
    expect(published).not.toContain("never published");
  });
});
