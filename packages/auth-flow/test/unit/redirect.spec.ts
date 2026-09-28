import { describe, expect, it } from "vitest";
import { parseRedirect } from "../../src/redirect";

describe("parseRedirect", () => {
  /** What a phone hands back: a custom scheme React Native's URL mangles. */
  it("reads a custom-scheme redirect", () => {
    expect(
      parseRedirect("olympus-auth-tester://auth?code=a-code&state=a-state"),
    ).toEqual({ code: "a-code", state: "a-state" });
  });

  it("reads a loopback redirect", () => {
    expect(
      parseRedirect(
        "http://127.0.0.1:52345/callback?error=access_denied&state=s",
      ),
    ).toEqual({ error: "access_denied", state: "s" });
  });

  it("decodes what was encoded, including a plus as a space", () => {
    expect(
      parseRedirect("app://auth?state=a%2Fb%20c&note=one+two&code=a%3Db"),
    ).toEqual({ state: "a/b c", note: "one two", code: "a=b" });
  });

  it("is empty when there is no query, rather than guessing", () => {
    expect(parseRedirect("olympus-auth-tester://auth")).toEqual({});
    expect(parseRedirect("olympus-auth-tester://auth?")).toEqual({});
  });

  /**
   * Nothing in this flow travels in a fragment, and a client that read one
   * would accept parameters a redirect never delivered.
   */
  it("ignores a fragment", () => {
    expect(parseRedirect("app://auth?code=a#state=forged")).toEqual({
      code: "a",
    });
  });

  it("keeps a parameter with no value, so a caller can see it arrived", () => {
    expect(parseRedirect("app://auth?code")).toEqual({ code: "" });
  });
});
