import { ClientError } from "graphql-request";

/** Whether Hasura refused a write for a unique key or index. */
export const isUniqueViolation = (error: unknown): boolean =>
  error instanceof ClientError &&
  (error.response.errors ?? []).some(
    (e) =>
      (e.extensions as { code?: string } | undefined)?.code ===
      "constraint-violation",
  );

/**
 * Hasura's codes for a request it understood and refused for what it
 * holds: the same request gets the same answer however often it is sent.
 * Anything else (Postgres unreachable, a timeout) may pass on a retry.
 */
const REFUSED_CODES = new Set([
  "constraint-violation",
  "constraint-error",
  "data-exception",
  "validation-failed",
  "parse-failed",
  "not-supported",
]);

/** Whether Hasura refused a request in a way a retry will not change. */
export const isRefusedRequest = (error: unknown): boolean =>
  error instanceof ClientError &&
  (error.response.errors ?? []).some((e) =>
    REFUSED_CODES.has(
      (e.extensions as { code?: string } | undefined)?.code ?? "",
    ),
  );
