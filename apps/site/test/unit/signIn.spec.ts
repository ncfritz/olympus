import { describe, expect, it, vi } from "vitest";
import {
  CALLBACK_PATH,
  type Completion,
  createCompleter,
  isCallbackPath,
} from "../../src/auth/signIn";

const issued = {
  tokens: { accessToken: "an-access-token", expiresIn: 900 },
  returnTo: "/dionysus/movies",
} as unknown as Completion;

describe("createCompleter", () => {
  it("completes once however many times it is called", async () => {
    const complete = vi.fn(() => Promise.resolve(issued));
    const once = createCompleter(complete);

    await expect(once()).resolves.toBe(issued);
    await expect(once()).resolves.toBe(issued);

    expect(complete).toHaveBeenCalledTimes(1);
  });

  /**
   * The bug this exists for: the callback page's effect ran again when the
   * router object changed, the second run found the pending request already
   * taken out of `sessionStorage`, and its "callback does not belong to a
   * sign-in this tab started" was what the person saw -- over a sign-in that
   * had in fact succeeded.
   */
  it("gives a caller who arrives mid-flight the first result, not a second attempt", async () => {
    let settle: (completion: Completion) => void = () => {};
    const complete = vi.fn(
      () =>
        new Promise<Completion>((resolve) => {
          settle = resolve;
        }),
    );
    const once = createCompleter(complete);

    const first = once();
    const second = once();
    expect(complete).toHaveBeenCalledTimes(1);

    settle(issued);
    expect(await first).toBe(issued);
    expect(await second).toBe(issued);
  });

  /** A refusal is an answer too: re-running it would report it against nothing. */
  it("remembers a refusal rather than trying again", async () => {
    const refused: Completion = { problem: "Sign-in was refused." };
    const complete = vi.fn(() => Promise.resolve(refused));
    const once = createCompleter(complete);

    await expect(once()).resolves.toBe(refused);
    await expect(once()).resolves.toBe(refused);

    expect(complete).toHaveBeenCalledTimes(1);
  });
});

describe("isCallbackPath", () => {
  it("is the path the API is registered to return to", () => {
    expect(isCallbackPath(CALLBACK_PATH)).toBe(true);
  });

  /**
   * What it guards: on that page the session comes from the code exchange, so
   * AuthProvider must not ask the API to use the refresh cookie in parallel.
   * Both replies set the cookie, and a refresh token presented twice looks like
   * a stolen one.
   */
  it("is not any other page, including the sign-in page beside it", () => {
    expect(isCallbackPath("/auth/signin")).toBe(false);
    expect(isCallbackPath("/")).toBe(false);
    expect(isCallbackPath("/dionysus/movies")).toBe(false);
    // A prefix match would have made these true; the query and hash are not
    // part of `window.location.pathname`, and a trailing slash is a different
    // page to the router.
    expect(isCallbackPath("/auth/callback/google")).toBe(false);
    expect(isCallbackPath("/auth/callbackish")).toBe(false);
  });
});
