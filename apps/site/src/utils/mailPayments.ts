import type {
  MailLabelChange,
  MailOpenBill,
  MailPaymentMatch,
} from "@ncfritz/olympus-sdk/minerva";
import { DateTime } from "luxon";

/** A state's own name: `Bills/*Paid` → `Paid`. */
export const stateName = (label: string): string =>
  (label.split("/").pop() ?? label).replace(/^\*/, "");

/** What marking a bill paid writes: its open state off, the closed on. */
export const transitionChange = (
  gmailId: string,
  fromLabel: string,
  toLabel: string,
): MailLabelChange => ({ gmailId, add: [toLabel], remove: [fromLabel] });

/** A match's move, for its bill. */
export const paymentChange = (m: MailPaymentMatch): MailLabelChange =>
  transitionChange(m.billGmailId, m.fromLabel, m.toLabel);

/** An open bill's move, when its family has one. */
export const billChange = (b: MailOpenBill): MailLabelChange | undefined =>
  b.toLabel ? transitionChange(b.gmailId, b.label, b.toLabel) : undefined;

const day = (time: string) =>
  DateTime.fromISO(time).toLocaleString({ month: "short", day: "numeric" });

/** "Marks “Your bill” of Sep 3 Paid". */
export const paymentText = (m: MailPaymentMatch): string =>
  `Marks “${m.billSubject ?? "the bill"}” of ${day(String(m.billReceivedTime))} ${stateName(m.toLabel)}`;

/** How long a bill has been open, in days. */
export const openDays = (b: MailOpenBill, now = DateTime.now()): number =>
  Math.max(
    0,
    Math.floor(now.diff(DateTime.fromISO(String(b.receivedTime)), "days").days),
  );

/** Where a bill's age turns: under a month green, to a quarter yellow, red. */
export const AGE_MONTH = 30;
export const AGE_QUARTER = 90;

/**
 * A bill's age as a colour on a green, yellow, red scale: the hue falls
 * from green at 0 days to yellow at 30 and red from 90; a light background
 * and a dark text of the same hue.
 */
export const ageColors = (
  days: number,
): { background: string; color: string } => {
  const d = Math.max(0, days);
  const hue =
    d <= AGE_MONTH
      ? 120 - 60 * (d / AGE_MONTH)
      : d <= AGE_QUARTER
        ? 60 - 60 * ((d - AGE_MONTH) / (AGE_QUARTER - AGE_MONTH))
        : 0;
  const h = Math.round(hue);
  return {
    background: `hsl(${h}, 75%, 88%)`,
    color: `hsl(${h}, 60%, 24%)`,
  };
};
