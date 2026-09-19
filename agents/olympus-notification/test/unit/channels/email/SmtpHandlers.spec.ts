import * as nodemailer from "nodemailer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailFormatters } from "../../../../src/channels/email/formatters/EmailFormatters";
import { GmailHandler } from "../../../../src/channels/email/handlers/GmailHandler";
import { SynologyMailHandler } from "../../../../src/channels/email/handlers/SynologyMailHandler";
import { smtpEvent } from "../../../fixtures/events";

vi.mock("nodemailer", () => ({ createTransport: vi.fn() }));

const sendMail = vi.fn();
const formatters = {
  formatterFor: () => ({
    formatNotification: async () => ({
      subject: "Subject",
      htmlPart: "<p>html</p>",
      plaintextPart: "text",
      attachments: [{ cid: "a", path: "/a.png" }],
    }),
  }),
} as unknown as EmailFormatters;

describe("SMTP handlers", () => {
  beforeEach(() => {
    sendMail.mockReset().mockResolvedValue({ response: "250 OK" });
    vi.mocked(nodemailer.createTransport)
      .mockReset()
      .mockReturnValue({ sendMail } as never);
  });

  it("sends through Gmail with the configured app password", async () => {
    const handler = new GmailHandler(formatters, {
      user: "me@example.test",
      appPassword: "app-password",
    });
    await handler.handle(smtpEvent({ cc: ["cc@example.test"], priority: "1" }));
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.gmail.com",
        auth: { user: "me@example.test", pass: "app-password" },
      }),
    );
    expect(sendMail).toHaveBeenCalledWith({
      from: "Olympus <olympus@example.test>",
      to: ["someone@example.test"],
      cc: ["cc@example.test"],
      bcc: undefined,
      subject: "Subject",
      text: "text",
      html: "<p>html</p>",
      headers: { "x-priority": "1" },
      attachments: [{ cid: "a", path: "/a.png" }],
    });
  });

  it("sends through the Synology mail server", async () => {
    const handler = new SynologyMailHandler(formatters, {
      host: "mail.test",
      user: "olympus",
      password: "secret",
    });
    await handler.handle(smtpEvent({ from: "" }));
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "mail.test",
        auth: { user: "olympus", pass: "secret" },
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Unknown <no-reply@internal.ncfritz.net>",
        headers: { "x-priority": "3" },
      }),
    );
  });
});
