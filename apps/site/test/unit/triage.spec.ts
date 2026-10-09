import type { ReviewItem } from "@ncfritz/olympus-sdk/minerva";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  deleteItem: vi.fn(async () => undefined),
  updateItem: vi.fn(async () => undefined),
}));
vi.mock("../../src/api/reviewsApi", () => ({ default: api }));

import { applyTriage } from "../../src/components/minerva/review/triage";

const item = (status: ReviewItem["status"], extra = {}) =>
  ({
    id: "today",
    status,
    periodStart: "2026-10-01",
    ...extra,
  }) as unknown as ReviewItem;
const copy = item("open", { id: "copy", carriedFromId: "today" });

/** What the API was asked, in order. */
const calls = () => [
  ...api.deleteItem.mock.calls.map((c) => ["delete", ...c]),
  ...api.updateItem.mock.calls.map((c) => ["update", ...c]),
];

describe("applyTriage", () => {
  let carry: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.clearAllMocks();
    carry = vi.fn(async () => undefined);
  });

  it.each([
    ["done", "done"],
    ["later", "someday"],
    ["drop", "dropped"],
  ] as const)("marks an open item %s", async (decision, status) => {
    await applyTriage(item("open"), decision, [], carry);
    expect(calls()).toEqual([["update", "today", { status }]]);
    expect(carry).not.toHaveBeenCalled();
  });

  it("carries an open item", async () => {
    await applyTriage(item("open"), "carry", [], carry);
    expect(carry).toHaveBeenCalledOnce();
    expect(calls()).toEqual([]);
  });

  it("opens a done item before carrying it", async () => {
    await applyTriage(item("done"), "carry", [], carry);
    expect(calls()).toEqual([["update", "today", { status: "open" }]]);
    expect(carry).toHaveBeenCalledOnce();
  });

  it.each([["done"], ["someday"], ["dropped"]] as const)(
    "takes back a %s decision, opening the item",
    async (status) => {
      await applyTriage(item(status), null, [], carry);
      expect(calls()).toEqual([["update", "today", { status: "open" }]]);
    },
  );

  it("takes back a carry by deleting the copy, which reopens the item", async () => {
    await applyTriage(item("carried"), null, [copy], carry);
    expect(calls()).toEqual([["delete", "copy"]]);
  });

  it("changes a carried item to done: the copy goes, then done", async () => {
    await applyTriage(item("carried"), "done", [copy], carry);
    expect(calls()).toEqual([
      ["delete", "copy"],
      ["update", "today", { status: "done" }],
    ]);
  });

  it("leaves a carried item carried when its copy is not loaded", async () => {
    await expect(
      applyTriage(item("carried"), "done", [], carry),
    ).rejects.toThrow("period not shown here");
    expect(calls()).toEqual([]);
  });

  it("does nothing to take back an open item", async () => {
    await applyTriage(item("open"), null, [], carry);
    expect(calls()).toEqual([]);
  });
});
