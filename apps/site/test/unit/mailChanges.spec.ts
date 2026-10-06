import type {
  MailAuditChange,
  MailChangeBatch,
} from "@ncfritz/olympus-sdk/minerva";
import { describe, expect, it } from "vitest";
import {
  batchSummary,
  canUndo,
  changesByAccount,
  proposalsByAccount,
  subLabelChanges,
} from "../../src/utils/mailChanges";

const proposal = (
  accountId: string,
  gmailId: string,
  label: string,
  action: "add" | "remove",
): MailAuditChange =>
  ({
    message: { accountId, gmailId, labels: [] },
    label,
    action,
    rule: "classifier",
    confidence: 0.9,
  }) as unknown as MailAuditChange;

const batch = (overrides: Partial<MailChangeBatch> = {}): MailChangeBatch =>
  ({
    id: "b1",
    accountId: "acc-1",
    kind: "apply",
    status: "done",
    requestedTime: "2026-10-06T21:00:00Z",
    messages: 3,
    counts: {
      pending: 0,
      written: 2,
      unchanged: 0,
      changed: 1,
      gone: 0,
      failed: 0,
    },
    labelOps: [],
    ...overrides,
  }) as MailChangeBatch;

describe("changesByAccount", () => {
  it("gathers each message's proposals into one change, per account", () => {
    const result = changesByAccount([
      proposal("acc-1", "a1", "Travel", "add"),
      proposal("acc-1", "a1", "Shopping", "remove"),
      proposal("acc-1", "a2", "Travel", "add"),
      proposal("acc-2", "b1", "Bills", "add"),
    ]);
    expect([...result]).toEqual([
      [
        "acc-1",
        [
          { gmailId: "a1", add: ["Travel"], remove: ["Shopping"] },
          { gmailId: "a2", add: ["Travel"], remove: [] },
        ],
      ],
      ["acc-2", [{ gmailId: "b1", add: ["Bills"], remove: [] }]],
    ]);
  });

  it("cancels a label both added and removed, and drops what is left empty", () => {
    const result = changesByAccount([
      proposal("acc-1", "a1", "Travel", "add"),
      proposal("acc-1", "a1", "Travel", "remove"),
    ]);
    expect(result.size).toBe(0);
  });
});

describe("proposalsByAccount", () => {
  it("lists the proposals to dismiss by account", () => {
    expect([
      ...proposalsByAccount([
        proposal("acc-1", "a1", "Travel", "add"),
        proposal("acc-2", "b1", "Bills", "remove"),
      ]),
    ]).toEqual([
      ["acc-1", [{ gmailId: "a1", label: "Travel", action: "add" }]],
      ["acc-2", [{ gmailId: "b1", label: "Bills", action: "remove" }]],
    ]);
  });
});

describe("the change log", () => {
  it("says what a batch did", () => {
    expect(batchSummary(batch())).toBe("2 written · 1 changed in Gmail since");
    expect(
      batchSummary(
        batch({
          status: "running",
          counts: { ...batch().counts, written: 0, changed: 0, pending: 3 },
        }),
      ),
    ).toBe("3 to go");
  });

  it("offers undo for a finished apply that wrote something, once", () => {
    expect(canUndo(batch())).toBe(true);
    expect(canUndo(batch({ undoneByBatchId: "b2" }))).toBe(false);
    expect(canUndo(batch({ kind: "undo" }))).toBe(false);
    expect(canUndo(batch({ status: "running" }))).toBe(false);
    expect(canUndo(batch({ counts: { ...batch().counts, written: 0 } }))).toBe(
      false,
    );
  });
});
