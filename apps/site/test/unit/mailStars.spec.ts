import type { MailStarMismatch } from "@ncfritz/olympus-sdk/minerva";
import { describe, expect, it } from "vitest";
import { fixText, starChanges, starName } from "../../src/utils/mailStars";

/* Synthetic mail (never real). */
const mismatch = (
  overrides: Partial<MailStarMismatch> = {},
): MailStarMismatch => ({
  accountId: "a1",
  gmailId: "1a",
  receivedTime: "2026-10-01T08:00:00.000Z",
  label: "Bills/*Payable",
  stateOpen: true,
  starred: false,
  fix: "star",
  wanted: "red-bang",
  ...overrides,
});

describe("star mismatches", () => {
  it("names the icon and the fix", () => {
    expect(starName("green-check")).toBe("green check");
    expect(starName(undefined)).toBe("a star");
    expect(fixText(mismatch())).toBe(
      "Star it (then set the red bang in Gmail)",
    );
    expect(fixText(mismatch({ fix: "done-icon", wanted: "green-check" }))).toBe(
      "Set the green check in Gmail",
    );
  });

  it("stars only what wants starring, by account, once each", () => {
    const changes = starChanges([
      mismatch(),
      mismatch(),
      mismatch({ accountId: "a2", gmailId: "2b" }),
      mismatch({ gmailId: "3c", fix: "attention-icon" }),
    ]);
    expect([...changes]).toEqual([
      ["a1", [{ gmailId: "1a", add: ["STARRED"], remove: [] }]],
      ["a2", [{ gmailId: "2b", add: ["STARRED"], remove: [] }]],
    ]);
  });
});
