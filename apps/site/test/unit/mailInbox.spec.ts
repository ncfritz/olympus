import type { MailInboxMessage } from "@ncfritz/olympus-sdk/minerva";
import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import {
  approvalOf,
  chunked,
  containedHtml,
  DEFAULT_APPROVE_OPTIONS,
  flagChangeText,
  gmailIdsByAccount,
  initialWants,
  isAmended,
  parseApproveOptions,
  pickerSuggestionsOf,
  reasonOf,
  senderOf,
  startOfToday,
  suggestedAdds,
  suggestedApprovals,
} from "../../src/utils/mailInbox";

/* Synthetic mail. */
const message = (overrides: Partial<MailInboxMessage> = {}): MailInboxMessage =>
  ({
    accountId: "acc-1",
    gmailId: "1a",
    threadId: "1a",
    threadSize: 1,
    fromName: "Example Air",
    fromAddress: "trips@example.test",
    subject: "Your trip",
    snippet: "Your booking is confirmed",
    receivedTime: "2026-10-06T08:00:00Z",
    inInbox: true,
    unread: true,
    starred: false,
    labels: ["Accounts/A"],
    suggestions: [
      { label: "Travel", score: 0.96, ticked: true, onMessage: false },
      { label: "Accounts/A", score: 0.7, ticked: true, onMessage: true },
      { label: "Bills", score: 0.3, ticked: false, onMessage: false },
    ],
    ...overrides,
  }) as unknown as MailInboxMessage;

describe("approving", () => {
  it("starts from the ticked suggestion the message lacks", () => {
    expect(suggestedAdds(message())).toEqual(["Travel"]);
    expect(initialWants(message())).toEqual({ Travel: "all" });
    expect(pickerSuggestionsOf(message())).toEqual([
      { label: "Travel", messages: 1, confidence: 0.96 },
      { label: "Bills", messages: 1, confidence: 0.3 },
    ]);
  });

  it("writes what the picker adds and takes off, creating what it made", () => {
    const m = message();
    expect(
      approvalOf(
        m,
        {
          Travel: "all",
          "Accounts/A": "none",
          "Trips/2026": "all",
          Bills: "none",
        },
        ["Trips/2026"],
      ),
    ).toEqual({
      approval: {
        gmailId: "1a",
        add: ["Travel", "Trips/2026"],
        remove: ["Accounts/A"],
      },
      newLabels: ["Trips/2026"],
    });
  });

  it("says when the labels are not the ticked suggestion's", () => {
    const m = message();
    expect(isAmended(m, initialWants(m))).toBe(false);
    expect(isAmended(m, {})).toBe(true);
    expect(isAmended(m, { Travel: "all", Bills: "all" })).toBe(true);
    expect(isAmended(m, { Travel: "all", "Accounts/A": "none" })).toBe(true);
  });

  it("approves as suggested by account, and groups IDs by account", () => {
    const messages = [
      message(),
      message({ gmailId: "2b", accountId: "acc-2", suggestions: [] }),
    ];
    expect(suggestedApprovals(messages)).toEqual(
      new Map([
        ["acc-1", [{ gmailId: "1a", add: ["Travel"], remove: [] }]],
        ["acc-2", [{ gmailId: "2b", add: [], remove: [] }]],
      ]),
    );
    expect(gmailIdsByAccount(messages)).toEqual(
      new Map([
        ["acc-1", ["1a"]],
        ["acc-2", ["2b"]],
      ]),
    );
    expect(chunked([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

describe("options and words", () => {
  it("reads stored options, keeping defaults for anything odd", () => {
    expect(parseApproveOptions(null)).toEqual(DEFAULT_APPROVE_OPTIONS);
    expect(
      parseApproveOptions({
        archive: false,
        markRead: "yes",
        wholeThread: true,
      }),
    ).toEqual({ archive: false, markRead: true, wholeThread: true });
  });

  it("begins today at local midnight", () => {
    const now = DateTime.fromISO("2026-10-06T19:54:00", {
      zone: "America/Los_Angeles",
    });
    expect(startOfToday(now)).toBe("2026-10-06T07:00:00.000Z");
  });

  it("says why, and who from", () => {
    expect(reasonOf({ score: 0.934, ticked: true })).toBe(
      "The classifier is 93% sure",
    );
    expect(reasonOf({ score: 0.3, ticked: false })).toMatch(/not ticked/);
    expect(senderOf({ fromAddress: "a@example.test" })).toBe("a@example.test");
    expect(senderOf({})).toBe("(no sender)");
  });

  it("shows Gmail's flags as what they did", () => {
    expect(flagChangeText("remove", "INBOX")).toBe("Archived");
    expect(flagChangeText("add", "INBOX")).toBe("Back in the inbox");
    expect(flagChangeText("add", "STARRED")).toBe("Starred");
    expect(flagChangeText("remove", "UNREAD")).toBe("Marked read");
    expect(flagChangeText("add", "Travel")).toBeUndefined();
  });
});

describe("containedHtml", () => {
  it("blocks remote content and refreshes, and opens links in a new tab", () => {
    const page = containedHtml(
      '<meta http-equiv="Refresh" content="0;url=https://tracker.example/"><p>Hi<img src="https://tracker.example/p.gif"></p>',
    );
    expect(page).toContain("default-src 'none'; img-src data:");
    expect(page).toContain('<base target="_blank">');
    expect(page).not.toMatch(/refresh/i);
    expect(page).toContain("<p>Hi");
  });
});
