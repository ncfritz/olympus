import moment, { type Moment } from "moment";

/** Length of the daily chart series returned by the statistics operations. */
export const SERIES_DAYS = 30;

/** Midnight UTC today: the last day of every daily series. */
export const startOfTodayUtc = (): Moment => moment.utc().startOf("day");

/**
 * `[timestamp, 0]` points for the `days` days ending today (oldest first,
 * today last).
 */
export const emptyDailySeries = (
  today: Moment,
  days = SERIES_DAYS,
): number[][] =>
  Array.from({ length: days }, (_, i) => [
    today
      .clone()
      .subtract(days - 1 - i, "days")
      .valueOf(),
    0,
  ]);

/**
 * Index of `time`'s day in a series built by `emptyDailySeries`, or
 * `undefined` when it falls outside the window.
 */
export const dailyIndex = (
  today: Moment,
  time: Moment,
  days = SERIES_DAYS,
): number | undefined => {
  const index =
    days - 1 - today.diff(time.clone().utc().startOf("day"), "days");
  return index >= 0 && index < days ? index : undefined;
};
