import { describe, expect, it } from "vitest";

import { STATUSES } from "../../src/status";
import { statusAccent, statusFill } from "../../src/theme";

describe("theme", () => {
  it("has a fill and an accent for every status", () => {
    for (const status of STATUSES) {
      expect(statusFill[status]).toMatch(/^#[0-9A-F]{6}$/);
      expect(statusAccent[status]).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});
