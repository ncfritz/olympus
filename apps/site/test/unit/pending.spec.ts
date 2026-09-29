import { describe, expect, it } from "vitest";
import {
  checkCallback,
  isCallbackReady,
  type Pending,
  readPending,
  returnableTo,
} from "../../src/auth/pending";

const pending: Pending = {
  verifier: "a-verifier",
  state: "a-state",
  returnTo: "/dionysus/movies",
};

describe("readPending", () => {
  it("reads what startSignIn wrote", () => {
    expect(readPending(JSON.stringify(pending))).toEqual(pending);
  });

  it("falls back to the root when there is nowhere to return to", () => {
    expect(
      readPending(JSON.stringify({ verifier: "v", state: "s" }))?.returnTo,
    ).toBe("/");
  });

  /** Anything unreadable is "no pending sign-in", which the check then refuses. */
  it("is nothing for an absent, unparseable or incomplete value", () => {
    expect(readPending(null)).toBeUndefined();
    expect(readPending("not json")).toBeUndefined();
    expect(readPending('"a string"')).toBeUndefined();
    expect(readPending(JSON.stringify({ state: "s" }))).toBeUndefined();
    expect(
      readPending(JSON.stringify({ verifier: "", state: "s" })),
    ).toBeUndefined();
  });
});

describe("checkCallback", () => {
  it("hands back the code and the verifier when everything matches", () => {
    const checked = checkCallback(
      { code: "a-code", state: "a-state" },
      pending,
    );
    expect(isCallbackReady(checked)).toBe(true);
    expect(checked).toEqual({
      code: "a-code",
      verifier: "a-verifier",
      returnTo: "/dionysus/movies",
    });
  });

  /** The API sends one code for every reason; its log has which. */
  it("reports an error before it trusts anything else", () => {
    const denied = checkCallback(
      { error: "access_denied", code: "a-code", state: "a-state" },
      pending,
    );
    expect(denied).toEqual({ problem: expect.stringContaining("refused") });

    expect(checkCallback({ error: "server_error" }, pending)).toEqual({
      problem: expect.stringContaining("server_error"),
    });
  });

  /**
   * A callback nobody asked for. This is the request the state check exists to
   * refuse, so an absent pending request has to fail rather than be skipped.
   */
  it("refuses a callback this tab did not start", () => {
    expect(
      checkCallback({ code: "a-code", state: "a-state" }, undefined),
    ).toEqual({ problem: expect.stringContaining("does not belong") });
  });

  it("refuses a state that does not match, or is missing", () => {
    expect(
      checkCallback({ code: "a-code", state: "another-state" }, pending),
    ).toEqual({ problem: expect.stringContaining("state") });
    expect(checkCallback({ code: "a-code" }, pending)).toEqual({
      problem: expect.stringContaining("state"),
    });
  });

  it("refuses a callback with no code in it", () => {
    expect(checkCallback({ state: "a-state" }, pending)).toEqual({
      problem: expect.stringContaining("no authorization code"),
    });
  });
});

describe("returnableTo", () => {
  it("keeps the page the person was on", () => {
    expect(returnableTo("/dionysus/movies?page=2")).toBe(
      "/dionysus/movies?page=2",
    );
  });

  /**
   * The loop this exists for: "Start again" navigates to /auth/signin, a
   * sign-in begun from there records it, and the callback sends the browser
   * back to the sign-in page it has just finished with -- a successful sign-in
   * that reads as a failed one.
   */
  it("refuses an auth page, which would land a finished sign-in back on one", () => {
    expect(returnableTo("/auth/signin")).toBe("/");
    expect(returnableTo("/auth/callback?code=abc")).toBe("/");
    expect(returnableTo("/auth")).toBe("/");
  });

  /** It has been through sessionStorage, so it is not trusted to be a path. */
  it("refuses anything that is not a path on this site", () => {
    expect(returnableTo("//evil.example/wherever")).toBe("/");
    expect(returnableTo("https://evil.example/wherever")).toBe("/");
    expect(returnableTo("dionysus/movies")).toBe("/");
    expect(returnableTo("")).toBe("/");
    expect(returnableTo(undefined)).toBe("/");
    expect(returnableTo(7)).toBe("/");
  });

  /** A path that merely starts with the letters is a page like any other. */
  it("keeps a path that only looks like one", () => {
    expect(returnableTo("/authors/asimov")).toBe("/authors/asimov");
  });
});
