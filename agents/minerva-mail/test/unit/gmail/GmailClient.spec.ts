import { describe, expect, it, vi } from "vitest";
import {
  GmailMailbox,
  type GmailTransport,
} from "../../../src/gmail/GmailClient";

const failure = (status: number, reason?: string) =>
  Object.assign(new Error(`status ${status}`), {
    response: {
      status,
      data: reason ? { error: { errors: [{ reason }] } } : undefined,
    },
  });

/** A transport answering from `answers` in turn, recording each call. */
const transportOf = (...answers: unknown[]) => {
  const calls: { url: string; params: Record<string, unknown> }[] = [];
  const transport = vi.fn(
    async (url: string, params: Record<string, unknown>) => {
      calls.push({ url, params });
      const answer = answers.shift();
      if (answer instanceof Error) throw answer;
      return answer;
    },
  );
  return { transport: transport as unknown as GmailTransport, calls };
};

describe("GmailMailbox", () => {
  it("pages message IDs, 500 a call, by label", async () => {
    const { transport, calls } = transportOf(
      { messages: [{ id: "a" }, { id: "b" }], nextPageToken: "p2" },
      { messages: [{ id: "c" }] },
    );
    const mailbox = new GmailMailbox(transport, 0);

    expect(await mailbox.messageIds("Label_1")).toEqual(["a", "b", "c"]);
    expect(calls.map((c) => c.params)).toEqual([
      { maxResults: 500, labelIds: "Label_1" },
      { maxResults: 500, labelIds: "Label_1", pageToken: "p2" },
    ]);
    expect(calls[0].url).toMatch(/\/users\/me\/messages$/);
  });

  it("names labels user or system", async () => {
    const { transport } = transportOf({
      labels: [
        { id: "INBOX", name: "INBOX", type: "system" },
        { id: "Label_1", name: "Accounts/A", type: "user" },
        { id: "CATEGORY_UPDATES", name: "CATEGORY_UPDATES" },
      ],
    });
    expect(await new GmailMailbox(transport, 0).labels()).toEqual([
      { id: "INBOX", name: "INBOX", type: "system" },
      { id: "Label_1", name: "Accounts/A", type: "user" },
      { id: "CATEGORY_UPDATES", name: "CATEGORY_UPDATES", type: "system" },
    ]);
  });

  it("tries again with backoff when Google says to slow down", async () => {
    const { transport, calls } = transportOf(
      failure(429),
      failure(403, "userRateLimitExceeded"),
      failure(503),
      { emailAddress: "owner@example.net", historyId: "9" },
    );
    const sleep = vi.fn(async (_ms: number) => undefined);
    const mailbox = new GmailMailbox(transport, 0, sleep);

    expect(await mailbox.profile()).toMatchObject({ historyId: "9" });
    expect(calls).toHaveLength(4);
    expect(mailbox.requests).toBe(4);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000, 4000]);
  });

  it("gives up on other failures at once", async () => {
    const { transport, calls } = transportOf(
      failure(403, "insufficientPermissions"),
    );
    const sleep = vi.fn(async (_ms: number) => undefined);
    await expect(
      new GmailMailbox(transport, 0, sleep).profile(),
    ).rejects.toThrow("status 403");
    expect(calls).toHaveLength(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("gives up after six tries", async () => {
    const { transport, calls } = transportOf(
      ...Array.from({ length: 7 }, () => failure(500)),
    );
    const sleep = vi.fn(async (_ms: number) => undefined);
    await expect(
      new GmailMailbox(transport, 0, sleep).profile(),
    ).rejects.toThrow("status 500");
    expect(calls).toHaveLength(6);
  });

  it("spaces requests by the interval", async () => {
    const { transport } = transportOf(
      { labels: [] },
      { labels: [] },
      { labels: [] },
    );
    const mailbox = new GmailMailbox(transport, 40);
    const started = Date.now();
    await Promise.all([mailbox.labels(), mailbox.labels(), mailbox.labels()]);
    expect(Date.now() - started).toBeGreaterThanOrEqual(75);
  });
});
