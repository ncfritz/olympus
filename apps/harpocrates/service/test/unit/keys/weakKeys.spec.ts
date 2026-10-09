import { generateKeyPairSync } from "crypto";
import { describe, expect, it } from "vitest";
import {
  hasClosePrimes,
  isRocaVulnerable,
  weakness,
} from "../../../src/keys/weakKeys";
import { rsaModulus } from "../../../src/pki/x509";

const rsa = () =>
  rsaModulus(
    generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey.export({
      type: "spki",
      format: "der",
    }),
  )!;

describe("weak keys (BR 6.1.1.3)", () => {
  it("passes an ordinary RSA key", () => {
    expect(weakness(rsa())).toBeUndefined();
  });

  it("passes a non-RSA key", () => {
    expect(weakness(undefined)).toBeUndefined();
  });

  it("finds primes too close together", () => {
    // Two primes a small distance apart: Fermat factors it at once.
    const p = 2n ** 127n - 1n; // a Mersenne prime
    const q = p + 2n ** 20n + 2n; // odd; not prime, but close is what matters
    expect(hasClosePrimes(p * q)).toBe(true);
    expect(weakness(p * q)).toMatch(/too close/);
  });

  it("finds the ROCA fingerprint", () => {
    // A number built only from powers of 65537 modulo each prime is what
    // ROCA's keys look like: 65537^k itself.
    const fingerprinted = 65537n ** 123n;
    expect(isRocaVulnerable(fingerprinted)).toBe(true);
    expect(isRocaVulnerable(rsa())).toBe(false);
  });
});
