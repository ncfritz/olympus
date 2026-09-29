import { describe, expect, it, vi } from "vitest";
import { createSocketAuth } from "../../src/auth/socket";
import type { Held, Session } from "../../src/auth/session";

const sessionHolding = (
  held: Held | undefined,
  token: () => Promise<string | undefined> = () =>
    Promise.resolve("a-rotated-token"),
): Session =>
  ({
    held: () => held,
    token,
  }) as unknown as Session;

const now = () => 1_000_000;

describe("createSocketAuth", () => {
  /**
   * The handshake is not cancellable, and socket.io-react-hook's own handlers
   * outlive the connection it forgets on unmount -- so an attempt still in
   * flight across one crashes inside the provider. Answering in the same tick
   * is what keeps the flow out of that window.
   */
  it("answers in the same tick when the page holds a live token", () => {
    const cb = vi.fn();
    createSocketAuth(
      sessionHolding({
        accessToken: "a-held-token",
        expiresAt: now() + 60_000,
      }),
      now,
    )(cb);

    expect(cb).toHaveBeenCalledWith({ token: "a-held-token" });
  });

  it("rotates when the held token has expired", async () => {
    const cb = vi.fn();
    createSocketAuth(
      sessionHolding({ accessToken: "a-stale-token", expiresAt: now() - 1 }),
      now,
    )(cb);

    expect(cb).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(cb).toHaveBeenCalledWith({ token: "a-rotated-token" }),
    );
  });

  it("rotates when the page holds nothing", async () => {
    const cb = vi.fn();
    createSocketAuth(sessionHolding(undefined), now)(cb);

    await vi.waitFor(() =>
      expect(cb).toHaveBeenCalledWith({ token: "a-rotated-token" }),
    );
  });

  /** Socket.IO waits for the callback: an attempt that never answers never fails. */
  it("answers with no token rather than not answering", async () => {
    const cb = vi.fn();
    createSocketAuth(
      sessionHolding(undefined, () => Promise.resolve(undefined)),
      now,
    )(cb);
    await vi.waitFor(() => expect(cb).toHaveBeenCalledWith({}));

    const refused = vi.fn();
    createSocketAuth(
      sessionHolding(undefined, () => Promise.reject(new Error("no cookie"))),
      now,
    )(refused);
    await vi.waitFor(() => expect(refused).toHaveBeenCalledWith({}));
  });
});
