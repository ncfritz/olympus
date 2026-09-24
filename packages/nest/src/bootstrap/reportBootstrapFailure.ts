import * as fs from "fs";

/** Just the part of Nest's `PartialGraphHost` this needs. */
export type PartialGraphSource = { toString(): string | undefined };

/** Enough of a Nest `Logger` to report with. */
export type BootstrapLogger = { error(message: string, stack?: string): void };

/**
 * A bootstrap failure: the error, and the partial dependency graph that
 * says which provider could not be constructed.
 *
 * Every service had its own copy of this; they were identical.
 */
export const reportBootstrapFailure = (
  error: unknown,
  graph: PartialGraphSource,
  logger: BootstrapLogger,
): void => {
  logger.error(
    "🤯🤯🤯 Error during bootstrap!",
    error instanceof Error ? error.stack : String(error),
  );

  if (process.env.NODE_ENV !== "production") {
    fs.writeFileSync("graph.json", graph.toString() ?? "");
  }
};
