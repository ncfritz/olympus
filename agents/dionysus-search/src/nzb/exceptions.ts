export class NZBException extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "NZBException";
  }
}

export class InvalidNZBError extends NZBException {
  constructor(message: string) {
    super(message);
    this.name = "InvalidNZBError";
  }
}
