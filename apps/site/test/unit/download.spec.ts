import { describe, expect, it } from "vitest";
import { fileNameOf } from "../../src/utils/download";

describe("downloads", () => {
  it("takes the file name from Content-Disposition, or the fallback", () => {
    expect(
      fileNameOf('attachment; filename="mail-audit-changes.csv"', "x.csv"),
    ).toBe("mail-audit-changes.csv");
    expect(fileNameOf("attachment; filename=a.csv", "x.csv")).toBe("a.csv");
    expect(fileNameOf(undefined, "x.csv")).toBe("x.csv");
  });
});
