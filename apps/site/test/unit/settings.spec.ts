import { describe, expect, it } from "vitest";
import { required } from "../../src/utils/settings";

describe("required", () => {
  it("keeps an absolute URL, port and all", () => {
    expect(required("X", "https://olympus.ncfritz.net")).toBe(
      "https://olympus.ncfritz.net",
    );
    expect(required("X", "https://content-cdn.sea.ncfritz.net:9443")).toBe(
      "https://content-cdn.sea.ncfritz.net:9443",
    );
    expect(required("X", "http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
  });

  /**
   * What this is for: the fallbacks these settings used to carry were the
   * development hosts, so a build with a forgotten argument produced a working
   * site quietly pointed at dev.
   */
  it("refuses an absent or empty value, naming itself", () => {
    expect(() => required("NEXT_PUBLIC_OLYMPUS_HOST", undefined)).toThrow(
      /NEXT_PUBLIC_OLYMPUS_HOST is not set/,
    );
    expect(() => required("NEXT_PUBLIC_OLYMPUS_HOST", "")).toThrow(
      /is not set/,
    );
  });

  /**
   * The names end in _HOST and the values are joined to paths, so a bare
   * hostname reads as a URL scheme and fails at the fetch, a long way from the
   * setting that caused it.
   */
  it("refuses a value with no scheme", () => {
    expect(() =>
      required(
        "NEXT_PUBLIC_CONTENT_CDN_HOST",
        "content-cdn.sea.ncfritz.net:9443",
      ),
    ).toThrow(/has no scheme/);
    expect(() => required("X", "olympus.ncfritz.net")).toThrow(/has no scheme/);
    expect(() => required("X", "//olympus.ncfritz.net")).toThrow(
      /has no scheme/,
    );
  });
});
