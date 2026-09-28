import { describe, expect, it } from "vitest";
import {
  revocationCoverage,
  revocationWarnings,
} from "../../../src/auth/services/revocation";

const certificates = (n: number): string =>
  Array.from(
    { length: n },
    () => "-----BEGIN CERTIFICATE-----\nx\n-----END CERTIFICATE-----\n",
  ).join("");

const list = (n = 1): string =>
  Array.from(
    { length: n },
    () => "-----BEGIN X509 CRL-----\nx\n-----END X509 CRL-----\n",
  ).join("");

describe("revocationCoverage", () => {
  it("counts the authorities in the bundle and the lists configured", () => {
    expect(
      revocationCoverage(certificates(3), [list(), list(), list()]),
    ).toEqual({ authorities: 3, lists: 3, bundled: 0 });
  });

  /** Node reads only the first list in a file, so a bundle counts once. */
  it("counts a file of several lists as the one Node will read", () => {
    const coverage = revocationCoverage(certificates(3), [list(3)]);
    expect(coverage).toEqual({ authorities: 3, lists: 1, bundled: 1 });
  });
});

describe("revocationWarnings", () => {
  it("says nothing when every authority has a list", () => {
    expect(
      revocationWarnings({ authorities: 3, lists: 3, bundled: 0 }),
    ).toEqual([]);
  });

  /**
   * The fault this exists for. A chain is checked against a list from every
   * authority in it, so one missing list refuses every client certificate --
   * and under TLS 1.3 neither end is told why, because the client's handshake
   * completes before the server validates its certificate.
   */
  it("names the shortfall and what it costs", () => {
    const [warning] = revocationWarnings({
      authorities: 3,
      lists: 2,
      bundled: 0,
    });
    expect(warning).toContain("3 authorities");
    expect(warning).toContain("2 revocation lists");
    expect(warning).toContain("refused during the handshake");
  });

  it("warns about a bundle whose extra lists are ignored", () => {
    expect(
      revocationWarnings({ authorities: 3, lists: 1, bundled: 1 }),
    ).toEqual([
      expect.stringContaining("refused during the handshake"),
      expect.stringContaining("only the first in a file"),
    ]);
  });
});
