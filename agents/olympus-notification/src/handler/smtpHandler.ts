import { NotificationContext } from "@ncfritz/olympus-sdk/olympus";
import { ConfigService } from "@nestjs/config";
import { Transporter } from "nodemailer";
import Mail from "nodemailer/lib/mailer";
import { MetadataWorkflowCompletionSmtpFormatter } from "../formatter/dionysus/metadataWorkflowCompleteFormatter";
import { TranscodeWorkflowCompleteSmtpFormatter } from "../formatter/dionysus/transcodeWorkflowCompleteFormatter";
import { NotificationFormatter } from "../formatter/formatter";
import { SystemTestSmtpFormatter } from "../formatter/olympus/systemTestFormatter";
import { SMTPDestinationEvent } from "../types/destinations";
import { SMTPPayload } from "../types/payloads";
import { logger } from "../util/logger";
import { BaseHandler } from "./baseHandler";

export abstract class SMTPHandler<
  T extends NotificationContext,
> extends BaseHandler<SMTPDestinationEvent<T>, SMTPPayload> {
  constructor(protected readonly configService: ConfigService) {
    super();
  }

  abstract getTransport(): Transporter;

  async transact(msg: SMTPDestinationEvent<T>, payload: SMTPPayload) {
    const message: Mail.Options = {
      from: msg.from || "Unknown <no-reply@internal.ncfritz.net",
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

    const transport = this.getTransport();

    const response = await transport.sendMail(message);

    logger.debug(`Got response: ${response.response} from SMTP server`);
  }

  getFormatterForType(
    type: string,
  ): NotificationFormatter<SMTPDestinationEvent<T>, SMTPPayload> | undefined {
    switch (type) {
      case "system_test":
        return new SystemTestSmtpFormatter();
      case "dionysus_metadata_workflow_completion":
        // @ts-expect-error okay
        return new MetadataWorkflowCompletionSmtpFormatter();
      case "dionysus_transcode_complete":
        // @ts-expect-error okay
        return new TranscodeWorkflowCompleteSmtpFormatter();
      default:
        return undefined;
    }
  }
}
