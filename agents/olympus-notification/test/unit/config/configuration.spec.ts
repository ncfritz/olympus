import { describe, expect, it } from "vitest";
import {
  ConfigValidationError,
  readConfig,
} from "../../../src/config/configuration";

describe("readConfig", () => {
  it("applies the defaults", () => {
    const config = readConfig({});
    expect(config.runtime.appName).toBe(
      "olympus-notification-agent-development",
    );
    expect(config.runtime.port).toBe(3100);
    expect(config.amqp.redactedUri).toBe(
      "amqp://admin:***@localhost:5672/%2Fdionysus-dev",
    );
    expect(config.olympus).toEqual({
      apiBaseUrl: "http://localhost:3001/v1",
      webSocketHost: "ws://localhost:3000",
    });
    expect(config.synologyChat).toEqual({
      host: "https://nfs02.sea.ncfritz.net",
      olympusBotToken: undefined,
      olympusChannelToken: undefined,
    });
    expect(config.gmail).toEqual({
      user: "ncfritz@ncfritz.net",
      appPassword: undefined,
    });
  });

  it("reads the delivery credentials", () => {
    const config = readConfig({
      SYNO_SMTP_PASSWORD: "smtp",
      SYNO_CHAT_OLYMPUS_BOT_TOKEN: "bot",
      SYNO_CHAT_OLYMPUS_CHANNEL_TOKEN: "channel",
      GMAIL_APP_PASSWORD: "gmail",
    });
    expect(config.synologyMail.password).toBe("smtp");
    expect(config.synologyChat.olympusBotToken).toBe("bot");
    expect(config.synologyChat.olympusChannelToken).toBe("channel");
    expect(config.gmail.appPassword).toBe("gmail");
  });

  it("reports every problem at once", () => {
    expect(() =>
      readConfig({ LISTEN_PORT: "metrics", AMQP_PROTOCOL: "http" }),
    ).toThrow(ConfigValidationError);
    try {
      readConfig({ LISTEN_PORT: "metrics", AMQP_PROTOCOL: "http" });
    } catch (e) {
      expect((e as ConfigValidationError).problems).toEqual([
        'LISTEN_PORT must be a port number, got "metrics"',
        'AMQP_PROTOCOL must be one of amqp, amqps, got "http"',
      ]);
    }
  });
});
