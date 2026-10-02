import { ClientError } from "graphql-request";

/** Whether Hasura refused a write for a unique key or index. */
export const isUniqueViolation = (error: unknown): boolean =>
  error instanceof ClientError &&
  (error.response.errors ?? []).some(
    (e) =>
      (e.extensions as { code?: string } | undefined)?.code ===
      "constraint-violation",
  );
