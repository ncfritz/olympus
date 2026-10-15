import { AuthFlowError } from "@ncfritz/olympus-auth-flow";

/*
 * What a failed load means for the person holding the phone. Pure.
 */

export type Failure =
  /** The session is over: sign in again. */
  | { kind: "signed-out"; message: string }
  /** The session may be fine; the API could not be reached or answered badly. */
  | { kind: "unreachable"; message: string };

const statusOf = (error: unknown): number | undefined => {
  const status = (error as { response?: { status?: unknown } } | undefined)
    ?.response?.status;
  return typeof status === "number" ? status : undefined;
};

/**
 * A refresh the API refused (the refresh token expired, was revoked, or was
 * reused) or a 401 from a call ends the session. A rate limit, a 5xx or no
 * answer at all does not: the tokens are kept and the person can retry.
 */
export const classifyFailure = (error: unknown): Failure => {
  if (error instanceof AuthFlowError) {
    if (error.message.startsWith("the API is rate limiting")) {
      return { kind: "unreachable", message: error.message };
    }
    return {
      kind: "signed-out",
      message: "Your session ended. Sign in again.",
    };
  }
  const status = statusOf(error);
  if (status === 401) {
    return {
      kind: "signed-out",
      message: "Your session ended. Sign in again.",
    };
  }
  if (status !== undefined) {
    return {
      kind: "unreachable",
      message: `Olympus answered ${status}. Try again in a moment.`,
    };
  }
  return {
    kind: "unreachable",
    message: "Can't reach Olympus. Check you're on the home network.",
  };
};
