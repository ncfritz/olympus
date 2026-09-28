import { describe, expect, it } from "vitest";
import { missingPrefix } from "../../src/paths";

describe("missingPrefix", () => {
  /** The mistake this exists for: ping is /olympus/ping, not /ping. */
  it("explains a path that lost its domain prefix", () => {
    expect(missingPrefix("/ping")).toContain("/olympus/ping");
  });

  it("says nothing about a path that has one", () => {
    for (const path of [
      "/olympus/ping",
      "/dionysus/movie/603",
      "/minerva/calendars",
      "/auth/me",
      "/.well-known/jwks.json",
    ]) {
      expect(missingPrefix(path)).toBeUndefined();
    }
  });

  it("says nothing about the root, where there is no segment to blame", () => {
    expect(missingPrefix("/")).toBeUndefined();
  });
});
