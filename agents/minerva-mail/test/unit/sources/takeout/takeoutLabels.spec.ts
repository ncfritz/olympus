import { describe, expect, it } from "vitest";
import {
  classifyLabels,
  parseLabelHeader,
} from "../../../../src/sources/takeout/takeoutLabels";

describe("parseLabelHeader", () => {
  it("splits on commas and trims", () => {
    expect(parseLabelHeader("Archived, Opened,Accounts/Example")).toEqual([
      "Archived",
      "Opened",
      "Accounts/Example",
    ]);
  });

  it("keeps a quoted name's commas and quotes", () => {
    expect(parseLabelHeader('Inbox,"Bills, Paid","Say ""hi"""')).toEqual([
      "Inbox",
      "Bills, Paid",
      'Say "hi"',
    ]);
  });

  it("drops empty names", () => {
    expect(parseLabelHeader(" , ,Starred,")).toEqual(["Starred"]);
  });
});

describe("classifyLabels", () => {
  it("splits user labels, system flags and categories", () => {
    const result = classifyLabels([
      "Archived",
      "Opened",
      "Inbox",
      "Unread",
      "Starred",
      "Important",
      "Category Updates",
      "Category Purchases",
      "Bills/*Paid",
      "Registrations & Confirmations",
      "IMAP_$NotJunk",
    ]);
    expect(result.labels).toEqual([
      "Bills/*Paid",
      "Registrations & Confirmations",
      "IMAP_$NotJunk",
    ]);
    expect(result.categories).toEqual(["updates", "purchases"]);
    expect(result.flags).toMatchObject({
      inbox: true,
      unread: true,
      starred: true,
      important: true,
      sent: false,
      chat: false,
    });
  });

  it("flags what the import skips", () => {
    expect(classifyLabels(["Chat"]).flags.chat).toBe(true);
    expect(classifyLabels(["Trash"]).flags.trash).toBe(true);
    expect(classifyLabels(["Spam"]).flags.spam).toBe(true);
  });

  it("does not take a nested user label for a system one", () => {
    expect(classifyLabels(["Inbox/Later"]).labels).toEqual(["Inbox/Later"]);
  });
});
