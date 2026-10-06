import { describe, expect, it } from "vitest";
import { suggestFamilies } from "../../src/utils/mailLabels";

const label = (id: string, name: string, kind = "topical") => ({
  id,
  accountId: "a",
  name,
  kind: kind as "topical",
  messages: 1,
});

describe("suggested label families", () => {
  it("finds a family in starred siblings, payable open and initial, paid closed", () => {
    expect(
      suggestFamilies([
        label("1", "Bills/SRP"),
        label("2", "Bills/*Paid"),
        label("3", "Bills/*Payable"),
      ]),
    ).toEqual([
      {
        name: "Bills",
        states: [
          { labelId: "3", name: "Bills/*Payable", open: true },
          { labelId: "2", name: "Bills/*Paid", open: false },
        ],
        initialLabelId: "3",
        transitions: [{ fromLabelId: "3", toLabelId: "2" }],
      },
    ]);
  });

  it("needs two topical siblings, an open one, and no family of that name", () => {
    expect(suggestFamilies([label("1", "Tasks/*Todo")])).toEqual([]);
    expect(
      suggestFamilies([label("1", "Done/*Paid"), label("2", "Done/*Filed")]),
    ).toEqual([]);
    expect(
      suggestFamilies(
        [label("2", "Bills/*Paid"), label("3", "Bills/*Payable")],
        ["Bills"],
      ),
    ).toEqual([]);
    expect(
      suggestFamilies([
        label("2", "Bills/*Paid", "state"),
        label("3", "Bills/*Payable", "state"),
      ]),
    ).toEqual([]);
  });
});
