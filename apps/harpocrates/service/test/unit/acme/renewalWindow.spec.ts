import { describe, expect, it } from "vitest";
import { renewalWindowOf } from "../../../src/acme/renewalWindow";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

describe("a certificate's renewal window (RFC 9773)", () => {
  const notBefore = new Date("2026-01-01T00:00:00Z");
  const notAfter = new Date(notBefore.getTime() + 90 * DAY);
  const now = notBefore.getTime() + 10 * DAY;

  it("runs from its profile's renewal age to half-way to its expiry", () => {
    expect(
      renewalWindowOf(
        { status: "valid", notBefore, notAfter, renewAtDays: 60 },
        now,
      ),
    ).toEqual({
      start: notBefore.getTime() + 60 * DAY,
      end: notBefore.getTime() + 75 * DAY,
    });
  });

  it("starts two thirds through its life without a profile", () => {
    expect(
      renewalWindowOf({ status: "valid", notBefore, notAfter }, now),
    ).toEqual({
      start: notBefore.getTime() + 60 * DAY,
      end: notBefore.getTime() + 75 * DAY,
    });
  });

  it("starts at its expiry at the latest", () => {
    expect(
      renewalWindowOf(
        { status: "valid", notBefore, notAfter, renewAtDays: 400 },
        now,
      ),
    ).toEqual({ start: notAfter.getTime(), end: notAfter.getTime() });
  });

  it("is already past for a revoked one", () => {
    expect(
      renewalWindowOf({ status: "revoked", notBefore, notAfter }, now),
    ).toEqual({ start: now - 2 * HOUR, end: now - HOUR });
  });
});
