import type { Moment } from "moment";

/** The records one batch run goes through, in order. */
export interface RecordSource<R> {
  /** Loads the records (`now`: the run's reference time). */
  init(now: Moment): Promise<void>;
  /** The next record; undefined at the end. */
  next(): Promise<R | undefined>;
  /** How many records there are (for the job's totalRecords). */
  count(): number;
  cleanup(): Promise<void>;
}
