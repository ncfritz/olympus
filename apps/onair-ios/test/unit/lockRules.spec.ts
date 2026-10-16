import { describe, expect, it } from "vitest";

import {
  afterBiometricFailure,
  afterWrongPasscode,
  biometricsAllowed,
  CLEAR_RECORD,
  MAX_BIOMETRIC_FAILURES,
  parseRecord,
  validPasscode,
  waitAfter,
  waitText,
} from "../../src/lockRules";

describe("passcode", () => {
  it("is six digits", () => {
    expect(validPasscode("012345")).toBe(true);
    expect(validPasscode("12345")).toBe(false);
    expect(validPasscode("12345a")).toBe(false);
  });

  it("waits as the iPhone does after wrong tries", () => {
    expect([5, 6, 7, 8, 9, 12].map(waitAfter)).toEqual([
      0, 60_000, 300_000, 900_000, 3_600_000, 3_600_000,
    ]);
    let record = CLEAR_RECORD;
    for (let i = 0; i < 5; i += 1) record = afterWrongPasscode(record, 1000);
    expect(record).toEqual({ failures: 5, waitUntil: 0, biometricFailures: 0 });
    record = afterWrongPasscode(record, 1000);
    expect(record.waitUntil).toBe(61_000);
    expect(waitText(61_000 - 1000)).toBe("Try again in 1 minute");
    expect(waitText(4 * 60_000 + 1)).toBe("Try again in 5 minutes");
  });

  it("stops offering Face ID after five failed tries, or a lockout", () => {
    let record = CLEAR_RECORD;
    for (let i = 0; i < MAX_BIOMETRIC_FAILURES - 1; i += 1) {
      record = afterBiometricFailure(record, false);
    }
    expect(biometricsAllowed(record)).toBe(true);
    expect(biometricsAllowed(afterBiometricFailure(record, false))).toBe(false);
    expect(biometricsAllowed(afterBiometricFailure(CLEAR_RECORD, true))).toBe(
      false,
    );
  });

  it("reads a stored record, and starts clean from a bad one", () => {
    expect(
      parseRecord(
        JSON.stringify({ failures: 2, waitUntil: 5, biometricFailures: 1 }),
      ),
    ).toEqual({ failures: 2, waitUntil: 5, biometricFailures: 1 });
    expect(parseRecord("nope")).toEqual(CLEAR_RECORD);
    expect(parseRecord(null)).toEqual(CLEAR_RECORD);
  });
});
