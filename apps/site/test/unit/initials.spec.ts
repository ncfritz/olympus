import { describe, expect, it } from "vitest";
import { initials } from "../../src/auth/initials";

describe("initials", () => {
  it("is the first and last initial of a name", () => {
    expect(initials("Neil Fritz")).toBe("NF");
    expect(initials("ada byron king lovelace")).toBe("AL");
  });

  it("is one letter for one word", () => {
    expect(initials("Neil")).toBe("N");
  });

  it("is a question mark when there is no name to use", () => {
    expect(initials(undefined)).toBe("?");
    expect(initials("")).toBe("?");
    expect(initials("   ")).toBe("?");
  });
});
