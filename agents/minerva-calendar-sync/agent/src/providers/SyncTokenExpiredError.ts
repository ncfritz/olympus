/**
 * Thrown by `incrementalSync` when the stored sync token has expired or is
 * otherwise no longer valid (e.g. Google's 410 Gone). Callers should clear
 * the persisted token and fall back to `fullSync`.
 */
export class SyncTokenExpiredError extends Error {
  constructor(calendarId: string, cause?: unknown) {
    super(`Sync token expired for calendar "${calendarId}"`, { cause });
    this.name = "SyncTokenExpiredError";
  }
}
