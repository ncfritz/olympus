/** How many requests, in how long. */
export interface RateLimit {
  /** Per client key, e.g. per address. */
  perClient: number;
  /** Across every client together, whatever the key. */
  global: number;
  windowSeconds: number;
}

/** Allowed, or how many seconds until the window that refused it resets. */
export type LimitDecision =
  | { allowed: true }
  | { allowed: false; scope: "client" | "global"; retryAfterSeconds: number };

interface Window {
  count: number;
  resetsAt: number;
}

/**
 * Fixed-window request counters, held in memory.
 *
 * Fixed window rather than sliding, deliberately: its one weakness is that
 * a caller can send the limit twice across a window boundary, and for a
 * limit whose purpose is containment rather than precision that is not
 * worth a ring buffer per key. Nothing here is a security boundary — the
 * codes, verifiers and refresh tokens these endpoints take are all 256-bit
 * and single-use, so there is nothing to guess. What this stops is one
 * caller filling the authorization store or the provider's token endpoint.
 *
 * Two counters per limit, and both have to allow the request:
 *
 *   - **Per client**, keyed by whatever the guard decides identifies the
 *     caller. Fair, as long as the key is meaningful.
 *   - **Global**, which is not keyed at all. This is the one that still
 *     works when the key turns out to be useless — behind a proxy that
 *     does not forward the client address, every caller shares one key,
 *     and a per-client limit then either does nothing or locks out
 *     everyone. The ceiling is the honest protection in that case.
 *
 * In memory, like the authorization store next to it, and with the same
 * consequence: it counts per API instance.
 */
export class RateLimiter {
  private readonly clients = new Map<string, Window>();
  private readonly globals = new Map<string, Window>();

  /**
   * Counts one request against `name`'s limits and says whether it may
   * proceed. A refused request is **not** counted: otherwise a caller that
   * keeps hammering would hold its own window open forever, turning a
   * one-minute limit into a permanent block.
   */
  check(
    name: string,
    key: string,
    limit: RateLimit,
    now: number = Date.now(),
  ): LimitDecision {
    const global = this.window(this.globals, name, limit, now);
    if (global.count >= limit.global) {
      return refusal("global", global, now);
    }
    const client = this.window(this.clients, `${name}\u0000${key}`, limit, now);
    if (client.count >= limit.perClient) {
      return refusal("client", client, now);
    }
    // Only now, so a refusal by either counter leaves both where they were.
    global.count += 1;
    client.count += 1;
    return { allowed: true };
  }

  /** For tests: how many windows are being held. */
  size(now: number = Date.now()): number {
    this.sweep(this.clients, now);
    this.sweep(this.globals, now);
    return this.clients.size + this.globals.size;
  }

  private window(
    windows: Map<string, Window>,
    key: string,
    limit: RateLimit,
    now: number,
  ): Window {
    const existing = windows.get(key);
    if (existing !== undefined && existing.resetsAt > now) return existing;
    // Sweeping here rather than on a timer: a timer in a request path is a
    // handle to leak, and this map only grows while requests arrive.
    this.sweep(windows, now);
    const fresh: Window = {
      count: 0,
      resetsAt: now + limit.windowSeconds * 1000,
    };
    windows.set(key, fresh);
    return fresh;
  }

  private sweep(windows: Map<string, Window>, now: number): void {
    for (const [key, window] of windows) {
      if (window.resetsAt <= now) windows.delete(key);
    }
  }
}

const refusal = (
  scope: "client" | "global",
  window: Window,
  now: number,
): LimitDecision => ({
  allowed: false,
  scope,
  // Rounded up, so Retry-After never names a moment that is still refused.
  retryAfterSeconds: Math.max(1, Math.ceil((window.resetsAt - now) / 1000)),
});
