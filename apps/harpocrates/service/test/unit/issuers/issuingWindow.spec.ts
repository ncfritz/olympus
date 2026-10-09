import { describe, expect, it } from "vitest";
import {
  addDays,
  childNotAfter,
  isIssuingWindowOpen,
  issuingWindowClosesAt,
} from "../../../src/issuers/issuingWindow";

const NOW = new Date("2026-09-25T00:00:00Z");

describe("the issuing window (ADR 0020, Longevity)", () => {
  it("closes when the longest certificate plus 30 days no longer fits", () => {
    const notAfter = addDays(NOW, 400);
    expect(issuingWindowClosesAt(notAfter, 365)).toEqual(addDays(NOW, 5));
    expect(isIssuingWindowOpen(notAfter, 365, NOW)).toBe(true);
    expect(isIssuingWindowOpen(notAfter, 365, addDays(NOW, 6))).toBe(false);
  });

  it("is closed for a CA without a certificate", () => {
    expect(isIssuingWindowOpen(null, 365, NOW)).toBe(false);
  });

  it("gives a child its tier's life, never past its parent", () => {
    expect(childNotAfter(NOW, "issuing", addDays(NOW, 10_000))).toEqual(
      addDays(NOW, 5 * 365),
    );
    expect(childNotAfter(NOW, "intermediate", addDays(NOW, 100))).toEqual(
      addDays(NOW, 100),
    );
  });
});
