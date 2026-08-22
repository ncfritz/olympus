export class NZBFailureError extends Error {
  readonly message: string;
  readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super();
    this.message = message;
    this.cause = cause;
  }
}
