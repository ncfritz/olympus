import { describe, expect, it } from "vitest";
import {
  clientLabel,
  isClientName,
  NO_RESPONSE,
  OTHER,
  statusCodeLabel,
  UNKNOWN,
} from "../../src";

describe("clientLabel", () => {
  it("keeps a valid client name", () => {
    expect(clientLabel("dionysus-metadata-agent")).toBe(
      "dionysus-metadata-agent",
    );
    expect(clientLabel(["olympus-site", "x"])).toBe("olympus-site");
  });

  it("is unknown without a header", () => {
    expect(clientLabel(undefined)).toBe(UNKNOWN);
    expect(clientLabel("")).toBe(UNKNOWN);
  });

  it.each(["Olympus-Site", "curl/8.1", "a b", "9lives", "x".repeat(64)])(
    "is other for %j",
    (value) => {
      expect(clientLabel(value)).toBe(OTHER);
      expect(isClientName(value)).toBe(false);
    },
  );
});

describe("statusCodeLabel", () => {
  it("is the status, or none without a response", () => {
    expect(statusCodeLabel(200)).toBe("200");
    expect(statusCodeLabel(503)).toBe("503");
    expect(statusCodeLabel(undefined)).toBe(NO_RESPONSE);
    expect(statusCodeLabel(0)).toBe(NO_RESPONSE);
  });
});
