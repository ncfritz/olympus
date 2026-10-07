import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { GmailClient, GmailMailbox } from "../../../src/gmail/GmailClient";
import {
  GmailMessageReader,
  MAX_BODY_CHARS,
} from "../../../src/gmail/GmailMessageReader";

// Synthetic mail.
const RAW = (html: string) =>
  [
    'From: "Example Air" <Trips@Example.test>',
    "To: someone@example.test, Other <other@example.test>",
    "Cc: copy@example.test",
    "Subject: Your trip",
    "Date: Mon, 05 Oct 2026 10:00:00 +0000",
    "MIME-Version: 1.0",
    'Content-Type: multipart/mixed; boundary="b1"',
    "",
    "--b1",
    'Content-Type: multipart/alternative; boundary="b2"',
    "",
    "--b2",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Your booking is confirmed.",
    "--b2",
    "Content-Type: text/html; charset=utf-8",
    "",
    html,
    "--b2--",
    "--b1",
    'Content-Type: application/pdf; name="ticket.pdf"',
    'Content-Disposition: attachment; filename="ticket.pdf"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from("%PDF-1.4 synthetic").toString("base64"),
    "--b1--",
    "",
  ].join("\r\n");

const setup = (html = "<p>Your booking is <b>confirmed</b>.</p>") => {
  const mailbox = {
    raw: vi.fn(async (id: string) => {
      if (id === "404") {
        throw Object.assign(new Error("Not Found"), {
          response: { status: 404 },
        });
      }
      return {
        id,
        threadId: "f1",
        labelIds: ["INBOX", "UNREAD"],
        internalDate: String(Date.parse("2026-10-05T10:00:01Z")),
        raw: Buffer.from(RAW(html)).toString("base64url"),
      };
    }),
  };
  const reader = new GmailMessageReader({} as GmailClient);
  const read = (id = "1a") =>
    reader.read(
      "someone@example.test",
      id,
      () => mailbox as unknown as GmailMailbox,
    );
  return { read, mailbox };
};

describe("GmailMessageReader", () => {
  it("reads a message's headers, bodies and attachments, never their content", async () => {
    const { read, mailbox } = setup();

    const content = await read();

    expect(mailbox.raw).toHaveBeenCalledWith("1a");
    expect(content).toEqual({
      gmailId: "1a",
      threadId: "f1",
      labelIds: ["INBOX", "UNREAD"],
      subject: "Your trip",
      from: { address: "Trips@Example.test", name: "Example Air" },
      replyTo: [],
      to: [
        { address: "someone@example.test" },
        { address: "other@example.test", name: "Other" },
      ],
      cc: [{ address: "copy@example.test" }],
      sentTime: "2026-10-05T10:00:00.000Z",
      receivedTime: "2026-10-05T10:00:01.000Z",
      text: "Your booking is confirmed.",
      html: "<p>Your booking is <b>confirmed</b>.</p>",
      truncated: false,
      attachments: [
        {
          filename: "ticket.pdf",
          mimeType: "application/pdf",
          sizeBytes: 18,
          inline: false,
        },
      ],
    });
  });

  it("cuts a body past the limit, and says so", async () => {
    const { read } = setup(`<p>${"x".repeat(MAX_BODY_CHARS)}</p>`);
    const content = await read();
    expect(content.html).toHaveLength(MAX_BODY_CHARS);
    expect(content.truncated).toBe(true);
  });

  it("answers not found for a message Gmail does not have, or an ID that is not one", async () => {
    const { read, mailbox } = setup();
    await expect(read("404")).rejects.toBeInstanceOf(NotFoundException);
    await expect(read("../labels")).rejects.toBeInstanceOf(NotFoundException);
    expect(mailbox.raw).toHaveBeenCalledTimes(1);
  });
});
