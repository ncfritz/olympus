import { describe, expect, it } from "vitest";
import { AccountMismatchError } from "../../../src/calendarAuth/AccountMismatchError";
import { confirmSameAccount } from "../../../src/calendarAuth/accountIdentity";

describe("confirmSameAccount", () => {
  describe("with a stored subject", () => {
    it("accepts the same subject, whatever the email", () => {
      expect(() =>
        confirmSameAccount("me@example.com", "sub-1", {
          subject: "sub-1",
          email: "renamed@example.com",
        }),
      ).not.toThrow();
    });

    it.each([
      ["another subject", { subject: "sub-2", email: "me@example.com" }],
      ["no subject", { email: "me@example.com" }],
    ])("refuses %s, even with the label's email", (_, signedIn) => {
      expect(() =>
        confirmSameAccount("me@example.com", "sub-1", signedIn),
      ).toThrow(AccountMismatchError);
    });
  });

  describe("without a stored subject", () => {
    it("accepts the label's email, whatever its case", () => {
      expect(() =>
        confirmSameAccount("Me@Example.com", undefined, {
          subject: "sub-1",
          email: "me@example.com",
        }),
      ).not.toThrow();
    });

    it("refuses another email", () => {
      expect(() =>
        confirmSameAccount("me@example.com", undefined, {
          email: "someone-else@example.com",
        }),
      ).toThrow(/Signed in as someone-else@example.com, not "me@example.com"/);
    });

    it("refuses when the provider gave no verified email", () => {
      expect(() =>
        confirmSameAccount("me@example.com", undefined, { subject: "sub-1" }),
      ).toThrow(/Could not confirm/);
    });
  });
});
