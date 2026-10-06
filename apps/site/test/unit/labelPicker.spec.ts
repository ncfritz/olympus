import type { MailAuditChange, MailLabel } from "@ncfritz/olympus-sdk/minerva";
import { describe, expect, it } from "vitest";
import {
  bulkChanges,
  describeWant,
  effectiveWant,
  labelEffects,
  labelsOn,
  nextWant,
  pathMatch,
  pickerMessages,
  pickerOptions,
  pickerSuggestions,
  pickLabel,
  RECENT_MAX,
  searchLabels,
  validNewPath,
  withRecent,
} from "../../src/utils/labelPicker";

const label = (name: string, overrides: Partial<MailLabel> = {}): MailLabel =>
  ({
    id: name,
    accountId: "acc-1",
    name,
    kind: "topical",
    messages: 10,
    ...overrides,
  }) as MailLabel;

const LABELS: MailLabel[] = [
  label("Shopping", { messages: 300 }),
  label("Shopping/Returns", { messages: 40 }),
  label("Shipping/Returns", { messages: 90 }),
  label("Travel", { messages: 5 }),
  label("Old/Travel", {
    kind: "retired",
    mergeTargetId: "Travel",
    mergeTargetName: "Travel",
  }),
  label("Bills/*Payable", {
    kind: "state",
    familyId: "f1",
    familyName: "Bills",
  }),
  label("Bills/*Paid", { kind: "state", familyId: "f1", familyName: "Bills" }),
  label("CATEGORY_UPDATES", { kind: "system" }),
];

const messages = [
  { gmailId: "a1", accountId: "acc-1", labels: ["Shopping", "Bills/*Payable"] },
  { gmailId: "a2", accountId: "acc-1", labels: ["Shopping"] },
  { gmailId: "b1", accountId: "acc-2", labels: [] },
];

describe("pathMatch and searchLabels", () => {
  it("matches the whole path in order, ignoring case", () => {
    expect(pathMatch("shret", "Shopping/Returns")).toBeDefined();
    expect(pathMatch("SHRET", "Shopping/Returns")).toBeDefined();
    expect(pathMatch("retsh", "Shopping/Returns")).toBeUndefined();
    expect(pathMatch("", "Anything")).toBe(0);
  });

  it("puts tighter matches first, then the more used", () => {
    const options = pickerOptions(LABELS);
    const found = searchLabels("returns", options).map((o) => o.name);
    // Both match contiguously; Shipping/Returns has more messages.
    expect(found).toEqual(["Shipping/Returns", "Shopping/Returns"]);
    expect(searchLabels("shop", options)[0].name).toBe("Shopping");
  });

  it("leaves system labels out and merges labels by name across mailboxes", () => {
    const options = pickerOptions([
      ...LABELS,
      label("Shopping", { accountId: "acc-2", messages: 5 }),
    ]);
    expect(options.find((o) => o.name === "CATEGORY_UPDATES")).toBeUndefined();
    expect(options.find((o) => o.name === "Shopping")?.messages).toBe(305);
  });
});

describe("validNewPath", () => {
  it("takes a path with no empty part", () => {
    expect(validNewPath("Shopping/Gifts")).toBe(true);
    expect(validNewPath("Shopping/")).toBe(false);
    expect(validNewPath("/Gifts")).toBe(false);
    expect(validNewPath("a//b")).toBe(false);
    expect(validNewPath("  ")).toBe(false);
  });
});

describe("three-state checkboxes", () => {
  it("shows keep as all or none when every or no message has it", () => {
    expect(effectiveWant(undefined, 3, 3)).toBe("all");
    expect(effectiveWant(undefined, 0, 3)).toBe("none");
    expect(effectiveWant(undefined, 1, 3)).toBe("keep");
  });

  it("cycles as it was → all → none → as it was for a label on some", () => {
    expect(nextWant("keep", 1, 3)).toBe("all");
    expect(nextWant("all", 1, 3)).toBe("none");
    expect(nextWant("none", 1, 3)).toBe("keep");
  });

  it("toggles between all and none otherwise", () => {
    expect(nextWant(undefined, 3, 3)).toBe("none");
    expect(nextWant("none", 3, 3)).toBe("all");
    expect(nextWant("all", 0, 3)).toBe("none");
  });

  it("says how many it is on and what applying changes", () => {
    expect(describeWant(undefined, 7, 12)).toBe("on 7 of 12");
    expect(describeWant("all", 7, 12)).toBe("adding to 5 · already on 7");
    expect(describeWant("all", 0, 12)).toBe("adding to 12");
    expect(describeWant("none", 7, 12)).toBe("removing from 7");
    expect(describeWant("all", 0, 1)).toBe("adding");
  });
});

describe("pickLabel", () => {
  const options = pickerOptions(LABELS);

  it("puts a label on every message", () => {
    const r = pickLabel({}, "Travel", options);
    expect(r.wants).toEqual({ Travel: "all" });
    expect(r.notes).toEqual([]);
  });

  it("applies a retired label's merge target, and says so", () => {
    const r = pickLabel({}, "Old/Travel", options);
    expect(r.label).toBe("Travel");
    expect(r.wants).toEqual({ Travel: "all" });
    expect(r.notes[0]).toMatch(/Old\/Travel is retired/);
  });

  it("replaces a family's other states, and says so", () => {
    const r = pickLabel({}, "Bills/*Paid", options);
    expect(r.wants).toEqual({ "Bills/*Paid": "all", "Bills/*Payable": "none" });
    expect(r.notes).toEqual(["Bills/*Paid replaces Bills/*Payable (Bills)"]);
  });
});

describe("bulkChanges and labelEffects", () => {
  it("adds and removes per message, a batch per mailbox, with new labels to create", () => {
    const wants = {
      "Bills/*Paid": "all",
      "Bills/*Payable": "none",
      Shopping: "keep",
      "Shopping/Gifts": "all",
    } as const;
    const result = bulkChanges(messages, { ...wants }, LABELS);
    expect(result.get("acc-1")).toEqual({
      changes: [
        {
          gmailId: "a1",
          add: ["Bills/*Paid", "Shopping/Gifts"],
          remove: ["Bills/*Payable"],
        },
        { gmailId: "a2", add: ["Bills/*Paid", "Shopping/Gifts"], remove: [] },
      ],
      newLabels: ["Shopping/Gifts"],
    });
    // acc-2 has none of these labels: each added one is made there first.
    expect(result.get("acc-2")?.newLabels).toEqual([
      "Bills/*Paid",
      "Shopping/Gifts",
    ]);
    expect(labelEffects(messages, { ...wants })).toEqual([
      { label: "Bills/*Paid", on: 0, adding: 3, removing: 0 },
      { label: "Bills/*Payable", on: 1, adding: 0, removing: 1 },
      { label: "Shopping/Gifts", on: 0, adding: 3, removing: 0 },
    ]);
  });

  it("leaves out messages with nothing to change", () => {
    const result = bulkChanges(messages, { Shopping: "none" }, LABELS);
    expect(result.get("acc-1")?.changes.map((c) => c.gmailId)).toEqual([
      "a1",
      "a2",
    ]);
    expect(result.has("acc-2")).toBe(false);
  });
});

describe("selection helpers", () => {
  const proposal = (
    gmailId: string,
    label: string,
    action: "add" | "remove",
    confidence: number,
  ) =>
    ({
      message: { accountId: "acc-1", gmailId, labels: ["Inbox-ish"] },
      label,
      action,
      confidence,
    }) as unknown as MailAuditChange;

  it("takes each message once and the suggestions to add", () => {
    const proposals = [
      proposal("m1", "Travel", "add", 0.8),
      proposal("m2", "Travel", "add", 0.95),
      proposal("m1", "Shopping", "remove", 0.9),
      proposal("m1", "Bills", "add", 0.99),
    ];
    expect(pickerMessages(proposals).map((m) => m.gmailId)).toEqual([
      "m1",
      "m2",
    ]);
    expect(pickerSuggestions(proposals)).toEqual([
      { label: "Travel", messages: 2, confidence: 0.95 },
      { label: "Bills", messages: 1, confidence: 0.99 },
    ]);
    expect(labelsOn(pickerMessages(proposals))).toEqual(["Inbox-ish"]);
  });

  it("keeps recent labels newest first, without repeats, up to the limit", () => {
    expect(withRecent(["a", "b"], ["b", "c"])).toEqual(["b", "c", "a"]);
    const many = Array.from({ length: 20 }, (_, i) => `l${i}`);
    expect(withRecent(many, ["x"])).toHaveLength(RECENT_MAX);
  });
});
