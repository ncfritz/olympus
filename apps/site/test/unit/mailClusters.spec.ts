import type {
  MailCluster,
  MailClusterPoint,
} from "@ncfritz/olympus-sdk/minerva";
import { describe, expect, it } from "vitest";
import {
  applyText,
  chunks,
  clusterChanges,
  clusterHref,
  OTHER_LABELS,
  pointGroups,
  purityText,
  reviewHref,
  suggestionText,
  UNLABELLED,
  worthALook,
} from "../../src/utils/mailClusters";

/* Synthetic clusters (never real mail). */
const cluster = (overrides: Partial<MailCluster> = {}): MailCluster => ({
  id: "c1",
  accountId: "a1",
  number: 0,
  scope: "unlabelled",
  name: "Mail from shop.example",
  size: 120,
  purity: 0,
  x: 0.2,
  y: 0.3,
  suggestion: "new-label",
  proposedName: "Shop",
  labels: [],
  senders: [{ sender: "orders@shop.example", messages: 100 }],
  ...overrides,
});

const split = cluster({
  id: "c2",
  number: 1,
  scope: "label",
  scopeLabel: "Travel",
  name: "Travel: air.example",
  size: 400,
  purity: 0.97,
  suggestion: "split",
  proposedName: "Travel/Air",
  labels: [{ label: "Travel", messages: 388 }],
});

const point = (gmailId: string, label?: string): MailClusterPoint => ({
  gmailId,
  x: 0.5,
  y: 0.5,
  ...(label ? { label } : {}),
});

describe("pointGroups", () => {
  it("colours by top-level label, busiest first, the unlabelled last", () => {
    const groups = pointGroups([
      point("1", "Travel/Air"),
      point("2", "Finance/Utilities"),
      point("3", "Travel"),
      point("4"),
      point("5", "Reading"),
    ]);
    expect(groups.map((g) => [g.name, g.points.length])).toEqual([
      ["Travel", 2],
      ["Finance", 1],
      ["Reading", 1],
      [UNLABELLED, 1],
    ]);
    expect(new Set(groups.map((g) => g.color)).size).toBe(4);
  });

  it("gathers the rest as other labels", () => {
    const groups = pointGroups(
      [point("1", "A"), point("2", "A"), point("3", "B"), point("4", "C")],
      1,
    );
    expect(groups.map((g) => [g.name, g.points.length])).toEqual([
      ["A", 2],
      [OTHER_LABELS, 2],
    ]);
  });
});

describe("a cluster's suggestion", () => {
  it("says what it suggests and what applying it does", () => {
    expect(suggestionText(cluster())).toBe("A new label, Shop");
    expect(suggestionText(split)).toBe("A sub-label of Travel, Travel/Air");
    expect(
      suggestionText(
        cluster({ suggestion: undefined, proposedName: undefined }),
      ),
    ).toBeUndefined();
    expect(applyText(split)).toContain("moves this group's 400 messages");
    expect(applyText(cluster())).toContain("adds it to this cluster's 120");
    expect(purityText(split)).toBe("97% Travel");
    expect(purityText(cluster())).toBe("No labels");
  });

  it("adds a new label, or moves a split's messages into its sub-label", () => {
    expect(clusterChanges(cluster(), ["1a", "1b", "1a"])).toEqual([
      { gmailId: "1a", add: ["Shop"], remove: [] },
      { gmailId: "1b", add: ["Shop"], remove: [] },
    ]);
    expect(clusterChanges(split, ["2a"])).toEqual([
      { gmailId: "2a", add: ["Travel/Air"], remove: ["Travel"] },
    ]);
    expect(clusterChanges(cluster({ suggestion: undefined }), ["1a"])).toEqual(
      [],
    );
  });

  it("lists those worth a look, largest first", () => {
    const plain = cluster({
      id: "c3",
      size: 999,
      suggestion: undefined,
      proposedName: undefined,
    });
    expect(worthALook([cluster(), plain, split]).map((c) => c.id)).toEqual([
      "c2",
      "c1",
    ]);
  });

  it("links to the label's review and back to the map", () => {
    expect(reviewHref(split)).toBe(
      "/minerva/mail/reclassification/label?name=Travel",
    );
    expect(reviewHref(cluster())).toBe("/minerva/mail/reclassification");
    expect(clusterHref(split)).toBe("/minerva/mail/clusters?cluster=c2");
  });
});

describe("chunks", () => {
  it("cuts a list into runs", () => {
    expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunks([], 2)).toEqual([]);
  });
});
