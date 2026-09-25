import { describe, expect, it } from "vitest";
import {
  ConfigValidationError,
  readConfig,
} from "../../../src/config/configuration";

const REQUIRED = {
  SIGNER_SOCKET_PATH: "/run/harpocrates/signer.sock",
  SIGNER_TOKEN_FILE: "/run/secrets/harpocrates_signer_token",
  AUTH_JWKS_URL: "http://olympus-api:3100/.well-known/jwks.json",
};

describe("readConfig", () => {
  it("defaults to a development service on 3200", () => {
    const config = readConfig(REQUIRED);
    expect(config.server).toMatchObject({
      nodeEnv: "development",
      isProduction: false,
      appName: "harpocrates-development",
      port: 3200,
      apiExplorer: true,
    });
    expect(config.auth).toEqual({
      jwksUrl: REQUIRED.AUTH_JWKS_URL,
      jwksFile: undefined,
      audience: "olympus-api",
      recentSignInSeconds: 300,
    });
    expect(config.pki).toEqual({
      realm: "ncfritz.net",
      organization: "ncfritz.net",
      distributionUrl: "http://pki.internal.ncfritz.net",
    });
  });

  it("keeps the API explorer off in production unless asked", () => {
    expect(
      readConfig({ ...REQUIRED, NODE_ENV: "production" }).server,
    ).toMatchObject({
      appName: "harpocrates",
      apiExplorer: false,
    });
    expect(
      readConfig({
        ...REQUIRED,
        NODE_ENV: "production",
        ENABLE_API_EXPLORER: "true",
      }).server.apiExplorer,
    ).toBe(true);
  });

  it("trims the distribution URL's trailing slash", () => {
    expect(
      readConfig({ ...REQUIRED, PKI_DISTRIBUTION_URL: "http://pki.example/" })
        .pki.distributionUrl,
    ).toBe("http://pki.example");
  });

  it("wants exactly one source of the API's keys", () => {
    expect(() =>
      readConfig({ ...REQUIRED, AUTH_JWKS_FILE: "/jwks.json" }),
    ).toThrow(/exactly one of AUTH_JWKS_URL and AUTH_JWKS_FILE/);
  });

  it("lists every invalid variable", () => {
    try {
      readConfig({
        LISTEN_PORT: "not-a-port",
        AUTH_RECENT_SIGN_IN_SECONDS: "-1",
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError);
      expect(String(error)).toMatch(/SIGNER_SOCKET_PATH/);
      expect(String(error)).toMatch(/AUTH_RECENT_SIGN_IN_SECONDS/);
    }
  });
});
