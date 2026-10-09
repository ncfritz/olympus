import { describe, expect, it } from "vitest";
import { optional, parseArguments, required } from "../../src/args";
import { TesterError } from "../../src/errors";

const SPEC = { value: ["api", "cert"], boolean: ["stale", "replay"] } as const;

describe("parseArguments", () => {
  it("keeps the command and its arguments in order", () => {
    expect(parseArguments(["call", "GET", "/auth/me"], SPEC)).toEqual({
      flags: {},
      positional: ["call", "GET", "/auth/me"],
    });
  });

  it("takes a value as the next argument or after an equals sign", () => {
    expect(parseArguments(["--api", "http://a/v1"], SPEC).flags.api).toBe(
      "http://a/v1",
    );
    expect(parseArguments(["--api=http://a/v1"], SPEC).flags.api).toBe(
      "http://a/v1",
    );
  });

  it("reads flags from anywhere among the arguments", () => {
    const { flags, positional } = parseArguments(
      ["refresh", "--replay", "--api", "http://a/v1"],
      SPEC,
    );
    expect(flags).toEqual({ replay: true, api: "http://a/v1" });
    expect(positional).toEqual(["refresh"]);
  });

  /**
   * The reason this parser refuses instead of collecting: `--state` is
   * `--stale` misspelt, and treating it as an argument would quietly send a
   * refreshed token to a command that was asked to send an expired one.
   */
  it("refuses an unknown flag rather than taking it as an argument", () => {
    expect(() => parseArguments(["whoami", "--state"], SPEC)).toThrow(
      /unknown option --state/,
    );
  });

  it("refuses a value flag with nothing after it", () => {
    expect(() => parseArguments(["--api"], SPEC)).toThrow(
      /--api needs a value/,
    );
  });

  it("refuses a value given to a flag that stands alone", () => {
    expect(() => parseArguments(["--stale=yes"], SPEC)).toThrow(
      /--stale takes no value/,
    );
  });
});

describe("required and optional", () => {
  it("name what the flag is for when it is missing", () => {
    expect(() => required({}, "cert", "the certificate to present")).toThrow(
      new TesterError("--cert is required: the certificate to present"),
    );
  });

  it("do not mistake a boolean flag for a value", () => {
    expect(optional({ stale: true }, "stale")).toBeUndefined();
  });
});
