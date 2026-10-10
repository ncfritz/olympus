/**
 * An error the service answered, with its message: openapi-fetch hands
 * back the body of a refusal rather than throwing, and this is what the
 * console throws in its place.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** A refusal that a newer sign-in would lift (ADR 0020: ceremonies, escrow). */
  get needsRecentSignIn(): boolean {
    return this.status === 403 && /recent sign-in/.test(this.message);
  }
}

/**
 * The data of an answer, or an ApiError with the service's message. The
 * service's errors are `{ message, statusCode }` (ErrorResponse).
 */
export const unwrap = <T>(answer: {
  data?: T;
  error?: unknown;
  response: Response;
}): T => {
  if (answer.error !== undefined || answer.data === undefined) {
    const message =
      typeof answer.error === "object" &&
      answer.error !== null &&
      "message" in answer.error
        ? String((answer.error as { message: unknown }).message)
        : `The service answered ${answer.response.status}`;
    throw new ApiError(answer.response.status, message);
  }
  return answer.data;
};

/** The same for an answer without a body (204). */
export const expectOk = (answer: { error?: unknown; response: Response }) => {
  if (!answer.response.ok) {
    unwrap({ ...answer, data: undefined });
  }
};

export const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
