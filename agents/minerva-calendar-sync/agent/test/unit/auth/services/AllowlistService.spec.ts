import { AllowlistService } from "../../../../src/auth/services/AllowlistService";
import { describe, expect, it } from "vitest";
import { testConfig } from "../../../support/config";

function serviceWithConfig(
  allowedEmails: string | undefined,
): AllowlistService {
  return new AllowlistService(
    testConfig({ AUTH_ALLOWED_EMAILS: allowedEmails }).auth,
  );
}

describe("AllowlistService", () => {
  it("allows an exact match", () => {
    const service = serviceWithConfig("alice@example.com,bob@example.com");
    expect(service.isAllowed("alice@example.com")).toBe(true);
    expect(service.isAllowed("bob@example.com")).toBe(true);
  });

  it("rejects an email not on the list", () => {
    const service = serviceWithConfig("alice@example.com");
    expect(service.isAllowed("mallory@example.com")).toBe(false);
  });

  it("is case-insensitive and trims whitespace in the config", () => {
    const service = serviceWithConfig(" Alice@Example.com , bob@example.com ");
    expect(service.isAllowed("alice@example.com")).toBe(true);
    expect(service.isAllowed("ALICE@EXAMPLE.COM")).toBe(true);
  });

  it("allows nothing when unconfigured", () => {
    const service = serviceWithConfig(undefined);
    expect(service.isAllowed("anyone@example.com")).toBe(false);
  });
});
