import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as jose from "jose";
import { describe, expect, it, vi } from "vitest";
import { SigningKeyService } from "../../../../src/auth/tokens/SigningKeyService";
import type { AuthConfigType } from "../../../../src/config/configuration";

const pem = async () => {
  const { privateKey } = await jose.generateKeyPair("ES256", {
    extractable: true,
  });
  return jose.exportPKCS8(privateKey);
};

const config = (signingKeys?: string) =>
  ({
    modes: { users: "report", services: "report" },
    rateLimits: "on",
    serviceRoles: {},
    users: { signingKeys, clientOrigins: [], providers: [] },
    services: {
      enabled: false,
      port: 3443,
      certificate: "",
      key: "",
      ca: "",
      revocationLists: [],
    },
  }) as AuthConfigType;

describe("SigningKeyService", () => {
  it("loads the keys and says which one signs", async () => {
    const dir = mkdtempSync(join(tmpdir(), "keys-"));
    writeFileSync(join(dir, "2026-01-01.pem"), await pem());
    writeFileSync(join(dir, "2026-09-01.pem"), await pem());

    const service = new SigningKeyService(config(dir));
    const logged: string[] = [];
    vi.spyOn(service["logger"], "log").mockImplementation(
      (message: unknown) => {
        logged.push(String(message));
      },
    );

    await service.onModuleInit();
    const keys = service.require();
    expect(keys.signer.source).toBe("2026-09-01.pem");
    expect(keys.byKid.size).toBe(2);
    // Filename order is a convention nothing enforces, so the start-up line
    // is the only place it is visible.
    expect(logged.join("\n")).toContain("signing with 2026-09-01.pem");
    expect(logged.join("\n")).toContain(keys.signer.kid);
  });

  it("is inert, not broken, where no directory is configured", async () => {
    const service = new SigningKeyService(config(undefined));
    vi.spyOn(service["logger"], "log").mockImplementation(() => undefined);
    await service.onModuleInit();
    expect(service.available()).toBeUndefined();
    expect(() => service.require()).toThrow(/not configured/);
  });

  it("is inert for a directory that exists and holds no keys", async () => {
    // What a host looks like before anyone has generated a key. The API has
    // to come up: refusing to start would take every endpoint down because
    // one feature is unconfigured.
    const empty = mkdtempSync(join(tmpdir(), "keys-empty-"));
    const service = new SigningKeyService(config(empty));
    const warned: string[] = [];
    vi.spyOn(service["logger"], "warn").mockImplementation(
      (message: unknown) => {
        warned.push(String(message));
      },
    );
    await service.onModuleInit();
    expect(service.available()).toBeUndefined();
    expect(warned.join("\n")).toContain("no .pem");
  });

  it("fails at start rather than at the first sign-in", async () => {
    const service = new SigningKeyService(config(join(tmpdir(), "not-a-dir")));
    await expect(service.onModuleInit()).rejects.toThrow();
  });
});
