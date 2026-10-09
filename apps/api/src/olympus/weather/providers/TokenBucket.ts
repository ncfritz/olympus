/**
 * A token bucket: `capacity` tokens, refilled evenly over `perMs`. Keeps a
 * provider's calls under its published limit from this one process
 * (ADR 0024: one API instance).
 */
export class TokenBucket {
  private tokens: number;
  private updatedAt: number;

  constructor(
    readonly capacity: number,
    private readonly perMs: number,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.updatedAt = now();
  }

  /**
   * Takes `count` tokens if that leaves at least `reserve` behind. A
   * reserve lets one kind of caller (tiles) leave room for another
   * (forecasts) on a shared allowance.
   */
  tryTake(count = 1, reserve = 0): boolean {
    this.refill();
    if (this.tokens - count < reserve) return false;
    this.tokens -= count;
    return true;
  }

  private refill() {
    const now = this.now();
    const elapsed = now - this.updatedAt;
    this.updatedAt = now;
    this.tokens = Math.min(
      this.capacity,
      this.tokens + (elapsed / this.perMs) * this.capacity,
    );
  }
}
