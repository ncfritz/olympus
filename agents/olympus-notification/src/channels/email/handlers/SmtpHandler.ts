import type { NotificationContext } from "@ncfritz/olympus-sdk/olympus";
import type { Transporter } from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import { DeliveryHandler } from "../../../delivery/DeliveryHandler";
import type { SmtpNotificationEvent } from "../../../delivery/events";
import type { EmailFormatters } from "../formatters/EmailFormatters";
import type { SmtpPayload } from "../payload";

type SmtpEvent = SmtpNotificationEvent<NotificationContext>;

/** Email delivery; subclasses supply the SMTP transport. */
export abstract class SmtpHandler extends DeliveryHandler<
  SmtpEvent,
  SmtpPayload
> {
  constructor(private readonly formatters: EmailFormatters) {
    super();
  }

  protected abstract transport(): Transporter;

  protected formatterFor(notificationType: string) {
    return this.formatters.formatterFor(notificationType);
  }

  protected async send(msg: SmtpEvent, payload: SmtpPayload): Promise<void> {
    const message: Mail.Options = {
      from: msg.from || "Unknown <no-reply@internal.ncfritz.net>",
      to: msg.to,
      cc: msg.cc,
      bcc: msg.bcc,
      subject: payload.subject,
      text: payload.plaintextPart,
      html: payload.htmlPart,
      headers: {
        "x-priority": msg.priority || "3",
      },
    };

    if (payload.attachments) {
      message.attachments = payload.attachments;
    }

    const response = await this.transport().sendMail(message);

    this.logger.debug(`Got response: ${response.response} from SMTP server`);
  }
}
