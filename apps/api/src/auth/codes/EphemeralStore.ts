import { randomBytes } from "crypto";

/** A 256-bit URL-safe token: an authorization code, or a provider state. */
export const randomToken = (): string => randomBytes(32).toString("base64url");

/**
 * Something short-lived, held in memory, that can be redeemed once.
 *
 * In memory rather than in Postgres, because these live for seconds and
 * nothing outside a single sign-in ever reads them. The consequence is
 * worth being explicit about: **it rules out running more than one API
 * instance** until these move to a shared store, because a sign-in that
 * starts on one instance and returns to another would not find its state.
 * A restart drops sign-ins that are mid-flight, which for a sixty-second
 * code is nothing and for a pending authorization is a retry.
 *
 * `take` is the only way to read: redeeming removes it, so a replayed code
 * finds nothing. That is the single-use property, and it is a property of
 * the store rather than of each caller remembering to delete.
 */
export class EphemeralStore<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();

  constructor(private readonly ttlSeconds: number) {}

  put(key: string, value: T, now: number = Date.now()): void {
    this.sweep(now);
    this.entries.set(key, { value, expiresAt: now + this.ttlSeconds * 1000 });
  }

  /** The value, once. Undefined if it was never there, or has expired. */
  take(key: string, now: number = Date.now()): T | undefined {
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;
    this.entries.delete(key);
    return entry.expiresAt > now ? entry.value : undefined;
  }

  /** For tests and metrics; not a way to read a value. */
  size(now: number = Date.now()): number {
    this.sweep(now);
    return this.entries.size;
  }

  /**
   * Dropped on write rather than on a timer: nothing here outlives a
   * sign-in, and a timer in a request path is a way to leak a handle.
   */
  private sweep(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }
}
