import { describe, expect, it, vi } from "vitest";
import type {
  GmailLabelInfo,
  GmailMailbox,
} from "../../../src/gmail/GmailClient";
import {
  readStarIcons,
  stateOfLabelIds,
  withStarIcon,
} from "../../../src/gmail/gmailState";

const LABELS = new Map<string, GmailLabelInfo>(
  [
    { id: "STARRED", name: "STARRED", type: "system" as const },
    { id: "INBOX", name: "INBOX", type: "system" as const },
    { id: "Label_1", name: "Accounts/A", type: "user" as const },
  ].map((l) => [l.id, l]),
);

describe("Gmail state", () => {
  it("searches each icon by its hidden label, as the API needs", async () => {
    const messageIds = vi.fn(async (_label?: string, query?: string) =>
      query === "l:^ss_cr" ? ["a"] : query === "l:^ss_sy" ? ["b", "c"] : [],
    );
    const icons = await readStarIcons({
      messageIds,
    } as unknown as GmailMailbox);

    expect(messageIds).toHaveBeenCalledTimes(12);
    expect(messageIds.mock.calls.map((c) => c[1])).toContain("l:^ss_cp");
    expect([...icons]).toEqual([
      ["b", "yellow-star"],
      ["c", "yellow-star"],
      ["a", "red-bang"],
    ]);
  });

  it("gives a starred message its icon, none found as null", () => {
    const icons = new Map([["a", "red-bang" as const]]);
    const starred = () => stateOfLabelIds(["STARRED", "Label_1"], LABELS);
    expect(withStarIcon(starred(), "a", icons)?.starIcon).toBe("red-bang");
    expect(withStarIcon(starred(), "b", icons)?.starIcon).toBeNull();
    expect(
      withStarIcon(stateOfLabelIds(["INBOX"], LABELS), "a", icons)?.starIcon,
    ).toBeNull();
    // Icons not read: the recorded icon is kept.
    expect(withStarIcon(starred(), "a", undefined)?.starIcon).toBeUndefined();
  });

  it("reads an icon from a hidden label when Gmail lists one", () => {
    expect(stateOfLabelIds(["STARRED", "^ss_cg"], LABELS)?.starIcon).toBe(
      "green-check",
    );
    expect(stateOfLabelIds(["^ss_cg"], LABELS)?.starIcon).toBeNull();
  });
});
