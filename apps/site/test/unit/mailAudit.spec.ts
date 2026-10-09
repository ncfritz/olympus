import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import {
  gmailLink,
  highConfidenceShare,
  isDormant,
  labelFlags,
  type LabelNode,
  labelTree,
  percent,
  pruneTree,
} from "../../src/utils/mailAudit";

const label = (name: string, messages = 1) => ({
  name,
  messages,
  proposedIn: 0,
  proposedOut: 0,
  highConfidence: 0,
  mergeCandidate: false,
});

describe("mail audit helpers", () => {
  it("nests labels by path, siblings by name, a bare path as its own row", () => {
    const tree = labelTree([
      label("Bills/Water", 2),
      label("Accounts/Utilities/Power", 5),
      label("Bills", 1),
      label("Bills/Power", 3),
    ]);
    expect(tree.map((n) => [n.key, n.isLabel])).toEqual([
      ["Accounts", false],
      ["Bills", true],
    ]);
    expect(tree[0].children![0]).toMatchObject({
      key: "Accounts/Utilities",
      leaf: "Utilities",
      isLabel: false,
      messages: 0,
    });
    expect(tree[0].children![0].children![0]).toMatchObject({
      key: "Accounts/Utilities/Power",
      leaf: "Power",
      messages: 5,
    });
    expect(tree[1].children!.map((n) => n.leaf)).toEqual(["Power", "Water"]);
  });

  it("calls a label dormant after two years without mail", () => {
    const now = DateTime.fromISO("2026-10-05T00:00:00Z");
    const node = { isLabel: true, messages: 3 };
    expect(
      isDormant({ ...node, lastReceivedTime: "2024-10-01T00:00:00Z" }, now),
    ).toBe(true);
    expect(
      isDormant({ ...node, lastReceivedTime: "2025-01-01T00:00:00Z" }, now),
    ).toBe(false);
    expect(isDormant({ isLabel: true, messages: 0 }, now)).toBe(false);
  });

  it("keeps rows with findings and the paths to them", () => {
    const tree = labelTree([
      { ...label("Accounts/Power"), proposedIn: 2 },
      label("Accounts/Water"),
      label("Shopping"),
    ]);
    const pruned = pruneTree(tree, (n) => n.proposedIn + n.proposedOut > 0);
    expect(pruned.map((n) => n.key)).toEqual(["Accounts"]);
    expect(pruned[0].children!.map((n) => n.key)).toEqual(["Accounts/Power"]);
    expect(pruned[0].children![0].children).toBeUndefined();
  });

  it("links to Gmail and shows confidences as percentages", () => {
    expect(gmailLink("1a0fab8f293aa5b5")).toBe(
      "https://mail.google.com/mail/u/0/#all/1a0fab8f293aa5b5",
    );
    expect(percent(0.934)).toBe("93%");
  });
});

describe("a label's flags and high-confidence share", () => {
  const now = DateTime.fromISO("2026-10-07T12:00:00Z");
  const node = (overrides: Partial<LabelNode> = {}): LabelNode => ({
    key: "Travel/Air",
    leaf: "Air",
    isLabel: true,
    messages: 40,
    proposedIn: 6,
    proposedOut: 2,
    highConfidence: 6,
    processed: 0,
    mergeCandidate: false,
    lastReceivedTime: "2026-09-01T00:00:00Z",
    ...overrides,
  });

  it("flags a merge, a split, a dormant label and an empty one", () => {
    expect(labelFlags(node(), new Set(), now)).toEqual([]);
    expect(
      labelFlags(
        node({
          mergeCandidate: true,
          lastReceivedTime: "2023-01-01T00:00:00Z",
        }),
        new Set(["Travel/Air"]),
        now,
      ),
    ).toEqual(["merge", "split", "dormant"]);
    expect(labelFlags(node({ messages: 0 }), undefined, now)).toEqual([
      "empty",
    ]);
    // A path that is not a label is never split or empty.
    expect(
      labelFlags(
        node({ isLabel: false, messages: 0 }),
        new Set(["Travel/Air"]),
        now,
      ),
    ).toEqual([]);
  });

  it("gives the share of proposals at high confidence, none without", () => {
    expect(highConfidenceShare(node())).toBe(0.75);
    expect(
      highConfidenceShare(node({ proposedIn: 0, proposedOut: 0 })),
    ).toBeUndefined();
  });
});
