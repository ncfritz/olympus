export class NotFoundClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundClientError";
  }
}
