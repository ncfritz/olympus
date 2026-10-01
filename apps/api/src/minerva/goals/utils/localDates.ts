import { BadRequestException } from "@nestjs/common";
import moment from "moment-timezone";

/** A calendar date as YYYY-MM-DD, the form `date` columns use on the wire. */
export type IsoDate = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The caller's timezone, from `x-ncfritz-tz`. An unknown name is a 400:
 * "today" decides habit days and cycle weeks, so a guess would be wrong
 * quietly.
 */
export const checkTimezone = (tz: string): string => {
  if (!moment.tz.zone(tz)) {
    throw new BadRequestException(`x-ncfritz-tz ${tz} is not a known timezone`);
  }
  return tz;
};

/** Today's date where the caller is. */
export const todayIn = (tz: string, now: Date = new Date()): IsoDate =>
  moment(now).tz(tz).format("YYYY-MM-DD");

/** Whether `value` is a real calendar date written YYYY-MM-DD. */
export const isIsoDate = (value: unknown): value is IsoDate =>
  typeof value === "string" &&
  ISO_DATE.test(value) &&
  moment.utc(value, "YYYY-MM-DD", true).isValid();

/** `date` moved by `days` (negative goes back). */
export const addDays = (date: IsoDate, days: number): IsoDate =>
  moment.utc(date, "YYYY-MM-DD").add(days, "days").format("YYYY-MM-DD");

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export const daysBetween = (from: IsoDate, to: IsoDate): number =>
  moment.utc(to, "YYYY-MM-DD").diff(moment.utc(from, "YYYY-MM-DD"), "days");

/** Whether `date` is a Monday. */
export const isMonday = (date: IsoDate): boolean =>
  moment.utc(date, "YYYY-MM-DD").isoWeekday() === 1;
