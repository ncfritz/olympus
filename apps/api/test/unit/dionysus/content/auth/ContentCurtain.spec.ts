import { FilterDefinition, FilterType } from "@ncfritz/olympus-model";
import { describe, expect, it } from "vitest";
import {
  BC_CHANNEL_FILTER,
  BC_FILTER,
} from "../../../../../src/dionysus/content/auth/contentAuth";
import { ContentCurtain } from "../../../../../src/dionysus/content/auth/ContentCurtain";

const FILTER: FilterDefinition = {
  type: FilterType.EQUALS,
  name: "content_id",
  value: "a",
};

describe("ContentCurtain", () => {
  it("leaves filters alone with content auth", () => {
    const curtain = new ContentCurtain(true);
    expect(curtain.restrict(FILTER)).toBe(FILTER);
    expect(curtain.restrict(undefined)).toBeUndefined();
  });

  it("adds the curtain without content auth", () => {
    const curtain = new ContentCurtain(false);
    expect(curtain.restrict(FILTER)).toEqual({
      type: FilterType.AND,
      name: "_",
      value: [BC_FILTER, FILTER],
    });
    expect(curtain.restrict(undefined)).toBe(BC_FILTER);
    expect(curtain.restrict(undefined, BC_CHANNEL_FILTER)).toBe(
      BC_CHANNEL_FILTER,
    );
  });
});
