import { describe, expect, it } from "vitest";
import { reportModeNote } from "../../src/output";

describe("reportModeNote", () => {
  /**
   * The trap it exists for: in report mode a header that disagrees with the
   * certificate is recorded and served, so a 200 is the check working.
   */
  it("explains a mismatch that was served anyway", () => {
    const note = reportModeNote(
      "olympus-notification-agent",
      "dionysus-search-agent",
      200,
    )!;
    expect(note).toContain("olympus-notification-agent");
    expect(note).toContain("dionysus-search-agent");
    expect(note).toContain("would_reject");
    expect(note).toContain("AUTH_MODE_SERVICES=enforce");
  });

  it("says nothing when the header is the certificate's own name", () => {
    expect(
      reportModeNote("dionysus-search-agent", "dionysus-search-agent", 200),
    ).toBeUndefined();
  });

  /** Once it is enforced there is nothing to explain: the refusal speaks. */
  it("says nothing when the call was refused", () => {
    expect(
      reportModeNote("someone-else", "dionysus-search-agent", 401),
    ).toBeUndefined();
  });
});
