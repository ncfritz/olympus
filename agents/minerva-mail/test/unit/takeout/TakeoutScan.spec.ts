import { describe, expect, it } from "vitest";
import { TakeoutScan } from "../../../src/takeout/TakeoutScan";
import { mbox, message, writeMbox } from "../../support/mbox";

const archive = () =>
  writeMbox(
    mbox(
      message({ id: "1", labels: "Archived,Accounts/A,Category Updates" }),
      message({ id: "2", labels: "Inbox,Unread,Accounts/B" }),
      message({ id: "3", labels: "Archived,Opened,Chat" }),
      message({ id: "4", thread: null }),
      message({ id: "5", labels: null }),
    ),
  );

describe("TakeoutScan", () => {
  it("counts what it read, and nothing of what the messages say", async () => {
    const report = await new TakeoutScan().run(archive());
    expect(report).toMatchObject({
      messages: 5,
      parsed: 4,
      failed: { "no-thread-id": 1 },
      skipped: { chat: 1, trash: 0, spam: 0, draft: 0 },
      flags: { inbox: 1, unread: 1, chat: 1 },
      categories: { updates: 1 },
      distinctLabels: 2,
      messagesWithoutLabels: 2,
      duplicateIds: 0,
      nextOffset: null,
    });
    expect(report.failedOffsets).toHaveLength(1);
    expect(JSON.stringify(report)).not.toMatch(/Hello|sender@example/);
  });

  it("stops at a limit and says where to resume", async () => {
    const path = archive();
    const first = await new TakeoutScan().run(path, { limit: 2 });
    expect(first.messages).toBe(2);
    expect(first.nextOffset).not.toBeNull();
    const rest = await new TakeoutScan().run(path, {
      offset: first.nextOffset!,
    });
    expect(rest.messages).toBe(3);
    expect(rest.nextOffset).toBeNull();
  });
});
