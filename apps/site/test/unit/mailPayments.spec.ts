import type {
  MailOpenBill,
  MailPaymentMatch,
} from "@ncfritz/olympus-sdk/minerva";
import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import {
  ageColors,
  billChange,
  openDays,
  paymentChange,
  paymentText,
  stateName,
} from "../../src/utils/mailPayments";

/* Synthetic mail (never real). */
const match = (
  overrides: Partial<MailPaymentMatch> = {},
): MailPaymentMatch => ({
  accountId: "a1",
  confirmationGmailId: "d1",
  confirmedTime: "2026-10-05T08:00:00.000Z",
  billGmailId: "b1",
  billSubject: "Your bill",
  billReceivedTime: "2026-09-03T08:00:00.000Z",
  fromLabel: "Bills/*Payable",
  toLabel: "Bills/*Paid",
  billStarred: false,
  matchedBy: "wording",
  ...overrides,
});

const bill = (overrides: Partial<MailOpenBill> = {}): MailOpenBill => ({
  accountId: "a1",
  gmailId: "b0",
  receivedTime: "2026-09-01T08:00:00.000Z",
  label: "Bills/*Payable",
  toLabel: "Bills/*Paid",
  starred: true,
  ...overrides,
});

describe("payments", () => {
  it("moves the bill along its transition", () => {
    expect(paymentChange(match())).toEqual({
      gmailId: "b1",
      add: ["Bills/*Paid"],
      remove: ["Bills/*Payable"],
    });
    expect(billChange(bill())).toEqual({
      gmailId: "b0",
      add: ["Bills/*Paid"],
      remove: ["Bills/*Payable"],
    });
    expect(billChange(bill({ toLabel: undefined }))).toBeUndefined();
  });

  it("says what it does", () => {
    expect(stateName("Bills/*Paid")).toBe("Paid");
    expect(paymentText(match())).toBe("Marks “Your bill” of Sep 3 Paid");
    expect(openDays(bill(), DateTime.fromISO("2026-10-01T09:00:00.000Z"))).toBe(
      30,
    );
  });

  it("colours a bill's age from green through yellow to red", () => {
    expect(ageColors(0).background).toBe("hsl(120, 75%, 88%)");
    expect(ageColors(30).background).toBe("hsl(60, 75%, 88%)");
    expect(ageColors(60).background).toBe("hsl(30, 75%, 88%)");
    expect(ageColors(140).background).toBe("hsl(0, 75%, 88%)");
    expect(ageColors(-3)).toEqual(ageColors(0));
  });
});
