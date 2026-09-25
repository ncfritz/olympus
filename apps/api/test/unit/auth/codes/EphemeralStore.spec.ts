import { describe, expect, it } from "vitest";
import {
  EphemeralStore,
  randomToken,
} from "../../../../src/auth/codes/EphemeralStore";

const T0 = 1_790_000_000_000;

describe("EphemeralStore", () => {
  it("returns a value once and then forgets it", () => {
    const store = new EphemeralStore<string>(60);
    store.put("k", "v", T0);
    expect(store.take("k", T0)).toBe("v");
    expect(store.take("k", T0)).toBeUndefined();
  });

  it("returns nothing for a key it never had", () => {
    expect(new EphemeralStore<string>(60).take("k", T0)).toBeUndefined();
  });

  it("returns the value up to the moment it expires", () => {
    const store = new EphemeralStore<string>(60);
    store.put("k", "v", T0);
    expect(store.take("k", T0 + 59_999)).toBe("v");
  });

  it("returns nothing once it has expired", () => {
    const store = new EphemeralStore<string>(60);
    store.put("k", "v", T0);
    expect(store.take("k", T0 + 60_000)).toBeUndefined();
  });

  it("consumes an expired entry rather than leaving it to be retried", () => {
    const store = new EphemeralStore<string>(60);
    store.put("k", "v", T0);
    store.take("k", T0 + 60_000);
    expect(store.size(T0)).toBe(0);
  });

  it("drops what has expired when something else is written", () => {
    const store = new EphemeralStore<string>(60);
    store.put("old", "v", T0);
    expect(store.size(T0)).toBe(1);
    store.put("new", "v", T0 + 120_000);
    // No timer: the sweep happens on write, so nothing accumulates while
    // sign-ins are happening and nothing runs while they are not.
    expect(store.size(T0 + 120_000)).toBe(1);
  });

  it("replaces a value put under the same key", () => {
    const store = new EphemeralStore<string>(60);
    store.put("k", "first", T0);
    store.put("k", "second", T0);
    expect(store.take("k", T0)).toBe("second");
  });
});

describe("randomToken", () => {
  it("is 256 bits of base64url", () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("does not repeat", () => {
    const tokens = new Set(Array.from({ length: 500 }, randomToken));
    expect(tokens.size).toBe(500);
  });
});
