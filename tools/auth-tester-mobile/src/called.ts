/**
 * One call, as the screen shows it.
 *
 * Imports nothing on purpose: the log line is the same whether the call went
 * through `@ncfritz/olympus-client` with a token or through the native module
 * with a certificate, and keeping this platform-free is what lets it be tested.
 */
export type Called = {
  method: string;
  path: string;
  status?: number;
  /** Milliseconds, as the app saw them: the round trip plus any rotation. */
  took: number;
  /** A line of what came back, or what went wrong. */
  answer: string;
};

/**
 * A call that answers with the status itself, because nothing threw for it: a
 * raw request made with `validateStatus: () => true`, where a 404 is the result
 * rather than a failure. Its status is the one to log.
 */
export type Answered = { status: number; body: unknown };

/** What to show for a body: a string as it is, anything else as JSON. */
const line = (value: unknown): string =>
  value === undefined
    ? "(no body)"
    : typeof value === "string"
      ? value
      : JSON.stringify(value);

const isAnswered = (value: unknown): value is Answered =>
  typeof value === "object" &&
  value !== null &&
  "body" in value &&
  typeof (value as { status?: unknown }).status === "number";

/**
 * Runs a call and says what happened, in a line, with no throwing left: a 401
 * is a result here, not a crash, and the screen shows it the same way as a 200.
 */
export const timed = async (
  method: string,
  path: string,
  call: () => Promise<unknown>,
): Promise<Called> => {
  const started = Date.now();
  try {
    const answer = await call();
    return {
      method,
      path,
      status: isAnswered(answer) ? answer.status : 200,
      took: Date.now() - started,
      answer: line(isAnswered(answer) ? answer.body : answer),
    };
  } catch (error: unknown) {
    // The SDK throws for a 4xx, and the status is the interesting part: a 401
    // here means the token or the certificate was refused, which is an answer.
    const status = (error as { response?: { status?: unknown } } | undefined)
      ?.response?.status;
    const body = (error as { response?: { data?: unknown } } | undefined)
      ?.response?.data;
    return {
      method,
      path,
      ...(typeof status === "number" ? { status } : {}),
      took: Date.now() - started,
      answer:
        body === undefined
          ? error instanceof Error
            ? error.message
            : String(error)
          : line(body),
    };
  }
};

/** A call in the log, which needs an identity of its own to be removed by. */
export type Logged = Called & { id: number };

let last = 0;

/**
 * Numbers a call for the log.
 *
 * A counter rather than the position in the list: a row keyed on its index is a
 * different row as soon as one above it goes, so removing the first entry would
 * animate the wrong one away and leave the text of its neighbour behind.
 */
export const logged = (called: Called): Logged => {
  last += 1;
  return { ...called, id: last };
};
