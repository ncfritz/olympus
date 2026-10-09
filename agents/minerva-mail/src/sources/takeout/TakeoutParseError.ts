export type TakeoutParseFailure =
  "bad-id" | "bad-thread-id" | "no-thread-id" | "bad-date" | "mime";

/**
 * A message the reader cannot use. Carries the message's byte offset, never
 * its content.
 */
export class TakeoutParseError extends Error {
  constructor(
    readonly reason: TakeoutParseFailure,
    readonly offset: number,
    detail?: string,
  ) {
    super(`${reason} at byte ${offset}${detail ? `: ${detail}` : ""}`);
    this.name = "TakeoutParseError";
  }
}
