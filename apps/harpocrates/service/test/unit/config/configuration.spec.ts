import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, expect, it } from "vitest";
import {
  ConfigValidationError,
  readConfig,
} from "../../../src/config/configuration";

const REQUIRED = {
  DATABASE_URL:
    "postgresql://harpocrates:secret@harpocrates-postgres/harpocrates",
  SIGNER_SOCKET_PATH: "/run/harpocrates/signer.sock",
  SIGNER_TOKEN_FILE: "/run/secrets/harpocrates_signer_token",
  AUTH_JWKS_URL: "http://olympus-api:3100/.well-known/jwks.json",
  PKI_PUBLISHED_DIR: "/srv/harpocrates/published",
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
      publishedDir: "/srv/harpocrates/published",
    });
    expect(config.crl).toEqual({
      validityHours: 168,
      refreshHours: 24,
      offlineValidityDays: 395,
      scheduleSeconds: 30,
    });
  });

  it("reads the database URL from a file, as the stack mounts it", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harpocrates-config-"));
    const file = path.join(dir, "database_url");
    fs.writeFileSync(
      file,
      "postgresql://harpocrates:from-file@db/harpocrates\n",
    );
    const { DATABASE_URL: _, ...rest } = REQUIRED;
    expect(readConfig({ ...rest, DATABASE_URL_FILE: file }).database.url).toBe(
      "postgresql://harpocrates:from-file@db/harpocrates",
    );
    fs.rmSync(dir, { recursive: true });
  });

  it("turns the scheduler off with 0 seconds", () => {
    expect(
      readConfig({ ...REQUIRED, CRL_SCHEDULE_SECONDS: "0" }).crl
        .scheduleSeconds,
    ).toBe(0);
  });

  it("refuses a list that expires before it is replaced", () => {
    expect(() =>
      readConfig({
        ...REQUIRED,
        CRL_VALIDITY_HOURS: "24",
        CRL_REFRESH_HOURS: "24",
      }),
    ).toThrow(/CRL_REFRESH_HOURS must be less than CRL_VALIDITY_HOURS/);
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
        CRL_SCHEDULE_SECONDS: "-5",
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError);
      expect(String(error)).toMatch(/SIGNER_SOCKET_PATH/);
      expect(String(error)).toMatch(/AUTH_RECENT_SIGN_IN_SECONDS/);
      expect(String(error)).toMatch(/PKI_PUBLISHED_DIR/);
      expect(String(error)).toMatch(/DATABASE_URL/);
      expect(String(error)).toMatch(
        /CRL_SCHEDULE_SECONDS must be an integer of at least 0/,
      );
    }
  });
});
