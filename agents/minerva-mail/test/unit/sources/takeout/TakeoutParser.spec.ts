import { describe, expect, it } from "vitest";
import type { MboxEntry } from "../../../../src/sources/takeout/MboxReader";
import {
  parseSeparatorDate,
  TakeoutParser,
} from "../../../../src/sources/takeout/TakeoutParser";
import { TakeoutParseError } from "../../../../src/sources/takeout/TakeoutParseError";
import { message } from "../../../support/mbox";

/** A fixture message as the reader yields it. */
const entry = (text: string, offset = 42): MboxEntry => {
  const [separator, ...rest] = text.split("\n");
  const m = /^From (\d+)@xxx (.+)$/.exec(separator)!;
  return {
    offset,
    decimalId: m[1],
    separatorDate: m[2],
    raw: Buffer.from(rest.join("\n")),
  };
};

const parser = new TakeoutParser();

describe("parseSeparatorDate", () => {
  it("reads the separator's date with its zone", () => {
    expect(parseSeparatorDate("Fri Oct 02 03:46:59 +0000 2026")).toBe(
      "2026-10-02T03:46:59.000Z",
    );
    expect(parseSeparatorDate("Thu Oct 01 20:00:00 -0700 2026")).toBe(
      "2026-10-02T03:00:00.000Z",
    );
    expect(parseSeparatorDate("yesterday")).toBeUndefined();
  });
});

describe("TakeoutParser", () => {
  it("gives the API's IDs, the dates, addresses and labels", async () => {
    const parsed = await parser.parse(
      entry(
        message({
          id: "1877908200997168565",
          thread: "1877908200997168565",
          labels: "Archived,Opened,Starred,Category Updates,Bills/*Payable",
          headers: [
            "From: Example Biller <Billing@Example.com>",
            "Reply-To: help@example.com",
            "To: Owner <owner@example.net>, other@example.net",
            "Cc: Team: a@example.org, b@example.org;",
            "Delivered-To: Owner@Example.net",
            "List-Id: Bills <bills.example.com>",
            "List-Unsubscribe: <mailto:u@example.com>",
            "Message-ID: <abc@example.com>",
            "Subject: =?UTF-8?B?WW91ciBiaWxsIOKAlCBPY3RvYmVy?=",
            "Date: Fri, 2 Oct 2026 03:46:58 +0000",
            "Content-Type: text/plain; charset=utf-8",
          ],
          body: "Your bill is ready.\n",
        }),
      ),
    );
    expect(parsed).toMatchObject({
      gmailId: "1a0fab8f293aa5b5",
      threadId: "1a0fab8f293aa5b5",
      receivedAt: "2026-10-02T03:46:59.000Z",
      sentAt: "2026-10-02T03:46:58.000Z",
      from: { address: "billing@example.com", name: "Example Biller" },
      replyTo: [{ address: "help@example.com" }],
      deliveredTo: "owner@example.net",
      listId: "bills.example.com",
      hasListUnsubscribe: true,
      messageIdHeader: "<abc@example.com>",
      subject: "Your bill — October",
      labels: ["Bills/*Payable"],
      categories: ["updates"],
      text: "Your bill is ready.",
      snippet: "Your bill is ready.",
      attachments: [],
    });
    expect(parsed.to.map((a) => a.address)).toEqual([
      "owner@example.net",
      "other@example.net",
    ]);
    expect(parsed.cc.map((a) => a.address)).toEqual([
      "a@example.org",
      "b@example.org",
    ]);
    expect(parsed.flags).toMatchObject({ starred: true, unread: false });
  });

  it("measures attachments without keeping them, and reads the text part", async () => {
    const parsed = await parser.parse(
      entry(
        message({
          id: "5",
          headers: [
            "From: a@example.com",
            "Subject: Statement",
            "Content-Type: multipart/mixed; boundary=XYZ",
          ],
          body: [
            "--XYZ",
            "Content-Type: text/plain; charset=iso-8859-1",
            "Content-Transfer-Encoding: quoted-printable",
            "",
            "Caf=E9 statement attached.",
            "--XYZ",
            'Content-Type: application/pdf; name="Statement-OCT.PDF"',
            'Content-Disposition: attachment; filename="Statement-OCT.PDF"',
            "Content-Transfer-Encoding: base64",
            "",
            Buffer.alloc(300, 1).toString("base64"),
            "--XYZ--",
            "",
          ].join("\n"),
        }),
      ),
    );
    expect(parsed.text).toBe("Café statement attached.");
    expect(parsed.attachments).toEqual([
      {
        mimeType: "application/pdf",
        extension: "pdf",
        sizeBytes: 300,
        inline: false,
      },
    ]);
    expect(JSON.stringify(parsed)).not.toContain("AQEB");
  });

  it("makes text from an HTML-only body", async () => {
    const parsed = await parser.parse(
      entry(
        message({
          id: "6",
          headers: [
            "From: a@example.com",
            "Content-Type: text/html; charset=utf-8",
          ],
          body: "<p>Sale&nbsp;today</p><p>Only</p>\n",
        }),
      ),
    );
    expect(parsed.text).toBe("Sale today\nOnly");
    expect(parsed.snippet).toBe("Sale today Only");
  });

  it("takes a message without a label header as unlabeled", async () => {
    const parsed = await parser.parse(
      entry(message({ id: "8", labels: null })),
    );
    expect(parsed.labels).toEqual([]);
    expect(parsed.categories).toEqual([]);
  });

  it("joins a label header Takeout folded onto a second line", async () => {
    // As Takeout wrote one on Neil's export: a long header continues on the
    // next line, and the label spans the break.
    const parsed = await parser.parse(
      entry(
        message({
          id: "9",
          labels:
            "Archived,Category Updates,Starred,Bills/SWG,Finance/Bank of\n America",
        }),
      ),
    );
    expect(parsed.labels).toEqual(["Bills/SWG", "Finance/Bank of America"]);
    expect(parsed.flags.starred).toBe(true);
  });

  it("refuses a message without a thread ID, naming its offset only", async () => {
    const failure = parser.parse(
      entry(message({ id: "9", thread: null }), 1234),
    );
    await expect(failure).rejects.toBeInstanceOf(TakeoutParseError);
    await expect(failure).rejects.toMatchObject({
      reason: "no-thread-id",
      offset: 1234,
    });
  });

  it("refuses a bad separator date", async () => {
    await expect(
      parser.parse(entry(message({ id: "10", date: "sometime" }))),
    ).rejects.toMatchObject({ reason: "bad-date" });
  });
});
