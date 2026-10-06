import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GmailConfigType } from "../../../src/config/configuration";
import type { GmailPoll } from "../../../src/gmail/GmailPoll";
import { GmailPoller } from "../../../src/gmail/GmailPoller";

const config = (pollSeconds: number) =>
  ({ clientId: "id", clientSecret: "secret", pollSeconds }) as GmailConfigType;

describe("GmailPoller", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("polls soon after starting, then every interval after the last poll ends", async () => {
    let finish: () => void = () => undefined;
    const poll = {
      pollAll: vi.fn(
        () => new Promise<[]>((resolve) => (finish = () => resolve([]))),
      ),
    };
    const poller = new GmailPoller(config(60), poll as unknown as GmailPoll);

    poller.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(poll.pollAll).toHaveBeenCalledTimes(1);

    // A slow poll is never overlapped by the next.
    await vi.advanceTimersByTimeAsync(120_000);
    expect(poll.pollAll).toHaveBeenCalledTimes(1);

    finish();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(poll.pollAll).toHaveBeenCalledTimes(2);

    finish();
    await poller.onApplicationShutdown();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(poll.pollAll).toHaveBeenCalledTimes(2);
  });

  it("carries on after a poll throws", async () => {
    const poll = {
      pollAll: vi
        .fn()
        .mockRejectedValueOnce(new Error("API down"))
        .mockResolvedValue([]),
    };
    const poller = new GmailPoller(config(10), poll as unknown as GmailPoll);

    poller.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(15_000);

    expect(poll.pollAll).toHaveBeenCalledTimes(2);
    await poller.onApplicationShutdown();
  });

  it("is off when the interval is 0 or Gmail's client is not configured", async () => {
    const poll = { pollAll: vi.fn() };
    for (const c of [config(0), { pollSeconds: 60 } as GmailConfigType]) {
      const poller = new GmailPoller(c, poll as unknown as GmailPoll);
      expect(poller.intervalMs).toBe(0);
      poller.onApplicationBootstrap();
    }
    await vi.advanceTimersByTimeAsync(600_000);
    expect(poll.pollAll).not.toHaveBeenCalled();
  });
});
