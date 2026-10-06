import { describe, expect, it } from "vitest";
import { csvField, csvRow } from "../../../src/utils/csv";

describe("csv", () => {
  it("leaves plain fields alone and empties nulls", () => {
    expect(csvRow(["a", 1, 0.9, null, undefined])).toBe("a,1,0.9,,\r\n");
  });

  it("quotes commas, quotes and line breaks, doubling quotes", () => {
    expect(csvField('Bill, "final"')).toBe('"Bill, ""final"""');
    expect(csvField("two\nlines")).toBe('"two\nlines"');
  });

  it("defuses what a spreadsheet would read as a formula", () => {
    expect(csvField("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvField("-5 off")).toBe("'-5 off");
    expect(csvField("@home")).toBe("'@home");
    expect(csvField(-5)).toBe("-5");
  });
});
