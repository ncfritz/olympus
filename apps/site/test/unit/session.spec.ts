import { describe, expect, it, vi } from "vitest";
import { createSession, type Held } from "../../src/auth/session";

const issuing = (accessToken: string, expiresIn = 600) =>
  vi.fn(async () => ({ accessToken, expiresIn }));

describe("the session", () => {
  it("has nothing until it asks, and then holds what it was given", async () => {
    const refresh = issuing("first");
    const session = createSession({ refresh, now: () => 1_000 });

    expect(session.held()).toBeUndefined();
    expect(await session.token()).toBe("first");
    expect(session.held()).toEqual({
      accessToken: "first",
      expiresAt: 1_000 + 600_000,
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("reuses a token that is still good", async () => {
    const refresh = issuing("first");
    const session = createSession({ refresh, now: () => 1_000 });

    await session.token();
    await session.token();
    await session.token();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  /** The margin exists so a call started now does not arrive with a dead token. */
  it("rotates inside the margin rather than at the expiry", async () => {
    let clock = 0;
    const refresh = issuing("first", 60);
    const session = createSession({
      refresh,
      margin: 30_000,
      now: () => clock,
    });

    await session.token();
    clock = 29_000; // 31s of life left: still good.
    await session.token();
    expect(refresh).toHaveBeenCalledTimes(1);

    clock = 31_000; // 29s left, inside the margin.
    await session.token();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  /**
   * The case ADR 0018 punishes: presenting one refresh token twice is
   * indistinguishable from a theft, so the API ends the session. A page load
   * firing a dozen calls at once must therefore rotate once, not a dozen times.
   */
  it("rotates once however many callers ask at the same moment", async () => {
    let release: (value: {
      accessToken: string;
      expiresIn: number;
    }) => void = () => undefined;
    const refresh = vi.fn(
      () =>
        new Promise<{ accessToken: string; expiresIn: number }>((resolve) => {
          release = resolve;
        }),
    );
    const session = createSession({ refresh, now: () => 0 });

    const asked = [
      session.token(),
      session.token(),
      session.token(),
      session.renew(),
    ];
    expect(refresh).toHaveBeenCalledTimes(1);

    release({ accessToken: "shared", expiresIn: 600 });
    expect(await Promise.all(asked)).toEqual([
      "shared",
      "shared",
      "shared",
      "shared",
    ]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("rotates again once the first rotation has finished", async () => {
    const refresh = vi
      .fn<() => Promise<{ accessToken: string; expiresIn: number }>>()
      .mockResolvedValueOnce({ accessToken: "first", expiresIn: 600 })
      .mockResolvedValueOnce({ accessToken: "second", expiresIn: 600 });
    const session = createSession({ refresh, now: () => 0 });

    expect(await session.token()).toBe("first");
    expect(await session.renew()).toBe("second");
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  /**
   * A refused refresh is the answer "signed out", not an exception: the caller
   * asked for a token, and there isn't one.
   */
  it("is signed out when the cookie is gone, without throwing", async () => {
    const refresh = vi.fn(async () => {
      throw new Error("the API refused: invalid_grant");
    });
    const session = createSession({ refresh, now: () => 0 });

    await expect(session.token()).resolves.toBeUndefined();
    expect(session.held()).toBeUndefined();
    await expect(session.restore()).resolves.toBe(false);
  });

  it("restores when the cookie is still good", async () => {
    const session = createSession({ refresh: issuing("first") });
    await expect(session.restore()).resolves.toBe(true);
  });

  it("tells watchers when the answer changes, until they stop watching", async () => {
    const seen: (Held | undefined)[] = [];
    const session = createSession({ refresh: issuing("first"), now: () => 0 });
    const stop = session.watch((held) => seen.push(held));

    await session.token();
    session.hold(undefined);
    stop();
    session.hold({ accessToken: "ignored", expiresIn: 600 });

    expect(seen).toEqual([
      { accessToken: "first", expiresAt: 600_000 },
      undefined,
    ]);
  });
});
