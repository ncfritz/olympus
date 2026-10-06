import { describe, expect, it } from "vitest";
import { mailLinkOutcome, mailReturnTo } from "../../src/utils/mailAccounts";

describe("mailLinkOutcome", () => {
  it.each([
    ["connected", undefined, "success", /Linked/],
    ["cancelled", undefined, "info", /cancelled/],
    ["expired", undefined, "warning", /too long/],
    ["refused", "another-account", "error", /another account/],
    ["refused", "owned", "error", /another mailbox/],
    ["failed", undefined, "error", /didn't work/],
  ])("says %s (%s)", (mailAccount, reason, type, title) => {
    const said = mailLinkOutcome({
      mailAccount,
      ...(reason ? { reason } : {}),
    });
    expect(said?.type).toBe(type);
    expect(said?.title).toMatch(title);
  });

  it("says nothing without an outcome", () => {
    expect(mailLinkOutcome({})).toBeUndefined();
    expect(mailLinkOutcome({ mailAccount: "odd" })).toBeUndefined();
  });

  it("comes back to the Inbox", () => {
    expect(mailReturnTo("https://olympus.example.com")).toBe(
      "https://olympus.example.com/minerva/mail",
    );
  });
});
