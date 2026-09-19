import { describe, expect, it } from "vitest";
import {
  ConfigValidationError,
  readConfig,
} from "../../../src/config/configuration";

describe("readConfig", () => {
  it("applies the defaults", () => {
    const config = readConfig({});
    expect(config.runtime.appName).toBe("dionysus-asset-agents-development");
    expect(config.runtime.port).toBe(3102);
    expect(config.amqp.redactedUri).toBe(
      "amqp://admin:***@localhost:5672/%2Fdionysus",
    );
    expect(config.olympus).toEqual({ apiBaseUrl: "http://localhost:3001/v1" });
    expect(config.media).toMatchObject({
      deploymentMode: "remote",
      transcodeCleanup: false,
      skipSshUpload: false,
      skipCdnDownload: false,
    });
    expect(config.downloads.nzbGet).toMatchObject({
      host: "localhost",
      port: 6789,
    });
    expect(config.downloads.persistEvents).toBe(false);
  });

  it("reads the media, download and content settings", () => {
    const config = readConfig({
      DEPLOYMENT_MODE: "local",
      STAGING_DIRECTORY: "/staging",
      TRANSCODE_CLEANUP: "true",
      DIONYSUS_CDN_SSH_HOST: "cdn",
      DIONYSUS_CDN_SSH_USERNAME: "user",
      NZBGET_HOST: "nzbget",
      NZBGET_PORT: "6790",
      CONTENT_ASSETS_DIR: "/assets",
      HANDBRAKE_PATH: "/usr/bin/HandBrakeCLI",
    });
    expect(config.media).toMatchObject({
      deploymentMode: "local",
      stagingDirectory: "/staging",
      transcodeCleanup: true,
      cdn: { host: "cdn", username: "user" },
    });
    expect(config.downloads.nzbGet).toMatchObject({
      host: "nzbget",
      port: 6790,
    });
    expect(config.content.assetsDir).toBe("/assets");
    expect(config.tools.handbrakePath).toBe("/usr/bin/HandBrakeCLI");
  });

  it("never puts the AMQP password in the loggable URI", () => {
    const { amqp } = readConfig({ AMQP_PASSWORD: "hunter2" });
    expect(amqp.uri).toContain("hunter2");
    expect(amqp.redactedUri).not.toContain("hunter2");
  });

  it("reports every problem at once", () => {
    try {
      readConfig({ NZBGET_PORT: "web", TRANSCODE_CLEANUP: "yes" });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      expect((e as ConfigValidationError).problems).toHaveLength(2);
    }
  });
});
