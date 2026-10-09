import { describe, expect, it } from "vitest";
import { decimalToGmailId } from "../../../../src/sources/takeout/gmailIds";

describe("decimalToGmailId", () => {
  it("writes Takeout's decimal IDs as the API's hexadecimal", () => {
    expect(decimalToGmailId("1877908200997168565")).toBe("1a0fab8f293aa5b5");
    expect(decimalToGmailId("255")).toBe("ff");
  });

  it("keeps precision past 2^53", () => {
    expect(decimalToGmailId("18446744073709551615")).toBe("ffffffffffffffff");
  });

  it.each([[""], ["12a"], ["-1"], ["1".repeat(21)]])("refuses %j", (value) => {
    expect(() => decimalToGmailId(value)).toThrow(RangeError);
  });
});
