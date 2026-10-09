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
 * from green at 0 days to yellow at 30 and red from 90 (hueColors).
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
  return hueColors(hue);
};

/**
 * A hue on the green, yellow, red scale (120 to 0) as the tables colour a
 * cell: a light background and a dark text of the same hue.
 */
export const hueColors = (
  hue: number,
): { background: string; color: string } => {
  const h = Math.round(hue);
  return {
    background: `hsl(${h}, 75%, 88%)`,
    color: `hsl(${h}, 60%, 24%)`,
  };
};

/** HSL (saturation and lightness 0 to 1) as RGB, 0 to 255. */
const hslToRgb = (h: number, s: number, l: number): number[] => {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map((n) =>
    Math.round(
      255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))),
    ),
  );
};

/** A colour channel's share of luminance (WCAG 2). */
const linear = (c: number) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

/**
 * The same hue as a solid badge: a saturated background, and the text
 * (near black or white) with the more contrast against it.
 */
export const hueSolid = (
  hue: number,
): { background: string; color: string } => {
  const h = Math.round(hue);
  const [r, g, b] = hslToRgb(h, 0.7, 0.45);
  const lum = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  return {
    background: `hsl(${h}, 70%, 45%)`,
    color:
      1.05 / (lum + 0.05) > (lum + 0.05) / 0.05
        ? "#ffffff"
        : "rgba(0, 0, 0, 0.88)",
  };
};
