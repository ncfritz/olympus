/**
 * Why a fetch failed, from the error it threw: "fetch failed" says nothing,
 * its cause does. A name with several addresses (localhost: ::1 and
 * 127.0.0.1) fails with an AggregateError whose message is empty, so its
 * errors are named instead: "ECONNREFUSED ::1:8480, ECONNREFUSED
 * 127.0.0.1:8480".
 */
export const fetchFailure = (error: unknown): string => {
  const cause =
    error instanceof Error && error.cause !== undefined ? error.cause : error;
  return describe(cause) || describe(error) || "no reason given";
};

const describe = (error: unknown): string => {
  if (error instanceof AggregateError && error.errors.length > 0) {
    return error.errors.map(describe).filter(Boolean).join(", ");
  }
  if (error instanceof Error) {
    const { code, address, port } = error as Error & {
      code?: unknown;
      address?: unknown;
      port?: unknown;
    };
    if (typeof code === "string") {
      return typeof address === "string"
        ? `${code} ${address}${typeof port === "number" ? `:${port}` : ""}`
        : code;
    }
    return error.message;
  }
  return error === undefined ? "" : String(error);
};
