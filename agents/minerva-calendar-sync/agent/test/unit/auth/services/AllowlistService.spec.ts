import { ConfigService } from "@nestjs/config";
import { AllowlistService } from "../../../../src/auth/services/AllowlistService";
import { describe, expect, it } from "vitest";

function serviceWithConfig(
  allowedEmails: string | undefined,
): AllowlistService {
  const config = { get: () => allowedEmails } as unknown as ConfigService;
  return new AllowlistService(config);
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
