import { ConfigService } from "@nestjs/config";
import { NotFoundException } from "@nestjs/common";
import { parseOidcProviders } from "../../../../src/auth/oidcProviderConfig";
import { OidcProviderRegistry } from "../../../../src/auth/services/OidcProviderRegistry";
import { describe, expect, it } from "vitest";

function registryWithConfig(raw: string | undefined): OidcProviderRegistry {
  const config = { get: () => raw } as unknown as ConfigService;
  return new OidcProviderRegistry(config);
}

describe("parseOidcProviders", () => {
  it("parses a valid provider list", () => {
    const providers = parseOidcProviders(
      JSON.stringify([
        {
          name: "google",
          issuer: "https://accounts.google.com",
          clientId: "id",
          clientSecret: "secret",
        },
      ]),
    );
    expect(providers).toEqual([
      {
        name: "google",
        issuer: "https://accounts.google.com",
        clientId: "id",
        clientSecret: "secret",
      },
    ]);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseOidcProviders("not json")).toThrow(/not valid JSON/);
  });

  it("throws when the value isn't an array", () => {
    expect(() => parseOidcProviders("{}")).toThrow(/must be a JSON array/);
  });

  it("throws when an entry is missing a required field", () => {
    expect(() =>
      parseOidcProviders(JSON.stringify([{ name: "google" }])),
    ).toThrow(/AUTH_OIDC_PROVIDERS\[0\]/);
  });
});

describe("OidcProviderRegistry", () => {
  it("resolves a configured provider", () => {
    const registry = registryWithConfig(
      JSON.stringify([
        {
          name: "google",
          issuer: "https://accounts.google.com",
          clientId: "id",
          clientSecret: "secret",
        },
      ]),
    );
    expect(registry.getProviderConfig("google").issuer).toBe(
      "https://accounts.google.com",
    );
  });

  it("throws NotFoundException for an unknown provider", () => {
    const registry = registryWithConfig("[]");
    expect(() => registry.getProviderConfig("unknown")).toThrow(
      NotFoundException,
    );
  });

  it("treats an unset config as no providers", () => {
    const registry = registryWithConfig(undefined);
    expect(() => registry.getProviderConfig("google")).toThrow(
      NotFoundException,
    );
  });
});
