import * as fs from "fs";
import * as os from "os";
import * as path from "path";

/** Just the part of Nest's `PartialGraphHost` this needs. */
export type PartialGraphSource = { toString(): string | undefined };

/** Enough of a Nest `Logger` to report with. */
export type BootstrapLogger = { error(message: string, stack?: string): void };

/** Where the partial graph went, or why it did not go anywhere. */
export type GraphDump =
  { written: string } | { skipped: "production" } | { failed: string };

/**
 * Nest's partial dependency graph, which says which provider could not be
 * constructed.
 *
 * It goes to the temporary directory, not the working directory: in a
 * container that is the application directory, owned by root and read-only
 * to the service. And it cannot throw — see `reportBootstrapFailure`.
 */
export const writePartialGraph = (
  graph: PartialGraphSource,
  environment: string | undefined = process.env.NODE_ENV,
): GraphDump => {
  if (environment === "production") return { skipped: "production" };
  const file = path.join(os.tmpdir(), "olympus-partial-graph.json");
  try {
    fs.writeFileSync(file, graph.toString() ?? "");
    return { written: file };
  } catch (e: unknown) {
    return { failed: e instanceof Error ? e.message : String(e) };
  }
};

/**
 * A bootstrap failure: the error, and where its partial dependency graph
 * was written.
 *
 * This runs while the process is already failing, so nothing in it may
 * throw. It used to: the graph was written to the working directory, which
 * on the NAS the service cannot write, so the handler's own `EACCES`
 * became the last line of the log and buried the failure that mattered.
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

  const dump = writePartialGraph(graph);
  if ("written" in dump) {
    logger.error(`Partial dependency graph: ${dump.written}`);
  } else if ("failed" in dump) {
    logger.error(
      `Could not write the partial dependency graph: ${dump.failed}`,
    );
  }
};
