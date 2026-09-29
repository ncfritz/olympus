import { describe, expect, it, vi } from "vitest";
import { listen, type Listening } from "../../src/auth/notifications";

const recorder = () => {
  const added: [string, unknown][] = [];
  const removed: [string, unknown][] = [];
  const socket: Listening = {
    on: (event, listener) => added.push([event, listener]),
    off: (event, listener) => removed.push([event, listener]),
  };
  return { socket, added, removed };
};

describe("listen", () => {
  it("adds the listener for that event", () => {
    const { socket, added } = recorder();
    const onMessage = vi.fn();

    listen(socket, "notification.push", onMessage);

    expect(added).toEqual([["notification.push", onMessage]]);
  });

  /**
   * The contract the replaced dependency broke: it left its own handlers on
   * sockets whose bookkeeping it had already thrown away, and they crashed when
   * they fired. Removing exactly what was added is the whole of it.
   */
  it("removes exactly what it added, and only when asked", () => {
    const { socket, removed } = recorder();
    const onMessage = vi.fn();

    const stop = listen(socket, "notification.push", onMessage);
    expect(removed).toEqual([]);

    stop();
    expect(removed).toEqual([["notification.push", onMessage]]);
  });

  it("leaves another listener on the same event alone", () => {
    const { socket, removed } = recorder();
    const first = vi.fn();
    const second = vi.fn();

    const stopFirst = listen(socket, "notification.push", first);
    listen(socket, "notification.push", second);
    stopFirst();

    expect(removed).toEqual([["notification.push", first]]);
  });
});
