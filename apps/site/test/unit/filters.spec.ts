import { describe, expect, it } from "vitest";
import { toggleKey } from "../../src/utils/filters";

describe("toggleKey", () => {
  it("adds a key that is not ticked", () => {
    expect(toggleKey(["draft"], "active")).toEqual(["draft", "active"]);
  });

  it("removes the last key ticked", () => {
    expect(toggleKey(["draft", "active"], "active")).toEqual(["draft"]);
  });

  it("removes only the key unticked, keeping those after it", () => {
    expect(toggleKey(["draft", "active", "paused"], "draft")).toEqual([
      "active",
      "paused",
    ]);
  });

  it("leaves the keys it is given alone", () => {
    const keys = ["draft"];
    toggleKey(keys, "active");
    expect(keys).toEqual(["draft"]);
  });
});
