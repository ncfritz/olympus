import { describe, expect, it } from "vitest";
import {
  type RateLimit,
  RateLimiter,
} from "../../../../src/auth/limits/RateLimiter";

/** Small numbers, so a test can reach both ceilings in a few lines. */
const LIMIT: RateLimit = { perClient: 2, global: 3, windowSeconds: 60 };

const START = 1_700_000_000_000;

describe("RateLimiter", () => {
  it("allows requests up to the per-client limit", () => {
    const limiter = new RateLimiter();
    expect(limiter.check("e", "a", LIMIT, START).allowed).toBe(true);
    expect(limiter.check("e", "a", LIMIT, START).allowed).toBe(true);
  });

  it("refuses the one after, naming the client scope", () => {
    const limiter = new RateLimiter();
    limiter.check("e", "a", LIMIT, START);
    limiter.check("e", "a", LIMIT, START);
    expect(limiter.check("e", "a", LIMIT, START)).toEqual({
      allowed: false,
      scope: "client",
      retryAfterSeconds: 60,
    });
  });

  it("counts each client separately", () => {
    const limiter = new RateLimiter();
    limiter.check("e", "a", LIMIT, START);
    limiter.check("e", "a", LIMIT, START);
    // a is done; b has spent nothing.
    expect(limiter.check("e", "a", LIMIT, START).allowed).toBe(false);
    expect(limiter.check("e", "b", LIMIT, START).allowed).toBe(true);
  });

  it("counts each endpoint separately", () => {
    const limiter = new RateLimiter();
    limiter.check("one", "a", LIMIT, START);
    limiter.check("one", "a", LIMIT, START);
    expect(limiter.check("one", "a", LIMIT, START).allowed).toBe(false);
    expect(limiter.check("two", "a", LIMIT, START).allowed).toBe(true);
  });

  it("refuses on the ceiling even though no one client is over", () => {
    const limiter = new RateLimiter();
    // Three clients, one request each: under the per-client limit of two,
    // and exactly at the global limit of three.
    for (const key of ["a", "b", "c"]) {
      expect(limiter.check("e", key, LIMIT, START).allowed).toBe(true);
    }
    expect(limiter.check("e", "d", LIMIT, START)).toEqual({
      allowed: false,
      scope: "global",
      retryAfterSeconds: 60,
    });
  });

  it("does not count a refused request, so a window cannot be held open", () => {
    const limiter = new RateLimiter();
    limiter.check("e", "a", LIMIT, START);
    limiter.check("e", "a", LIMIT, START);
    // Hammering through the window changes nothing.
    for (let at = START; at < START + 59_000; at += 1_000) {
      expect(limiter.check("e", "a", LIMIT, at).allowed).toBe(false);
    }
    // And the window still resets when it was always going to.
    expect(limiter.check("e", "a", LIMIT, START + 60_000).allowed).toBe(true);
  });

  it("leaves the ceiling alone when the per-client limit refuses", () => {
    const limiter = new RateLimiter();
    limiter.check("e", "a", LIMIT, START);
    limiter.check("e", "a", LIMIT, START);
    limiter.check("e", "a", LIMIT, START); // refused, client scope
    // a spent two of the three. If its refusal had counted, b would have
    // one left; it has two, because b is only stopped by the ceiling.
    expect(limiter.check("e", "b", LIMIT, START).allowed).toBe(true);
    expect(limiter.check("e", "b", LIMIT, START).allowed).toBe(false);
  });

  it("starts a fresh window once the old one has passed", () => {
    const limiter = new RateLimiter();
    limiter.check("e", "a", LIMIT, START);
    limiter.check("e", "a", LIMIT, START);
    expect(limiter.check("e", "a", LIMIT, START + 59_999).allowed).toBe(false);
    expect(limiter.check("e", "a", LIMIT, START + 60_000).allowed).toBe(true);
  });

  it("rounds Retry-After up, so it never names a moment still refused", () => {
    const limiter = new RateLimiter();
    limiter.check("e", "a", LIMIT, START);
    limiter.check("e", "a", LIMIT, START);
    // 100ms left of the window: waiting a whole second is right, waiting
    // zero is not.
    const decision = limiter.check("e", "a", LIMIT, START + 59_900);
    expect(decision).toEqual({
      allowed: false,
      scope: "client",
      retryAfterSeconds: 1,
    });
  });

  it("drops windows it no longer needs", () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 50; i += 1) {
      limiter.check("e", `client-${i}`, LIMIT, START);
    }
    expect(limiter.size(START)).toBeGreaterThan(50);
    expect(limiter.size(START + 60_000)).toBe(0);
  });
});
