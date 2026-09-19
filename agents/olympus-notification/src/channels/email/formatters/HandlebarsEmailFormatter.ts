import type { NotificationContext } from "@ncfritz/olympus-sdk/olympus";
import { Logger } from "@nestjs/common";
import type { Attachment } from "nodemailer/lib/mailer";
import type { SmtpNotificationEvent } from "../../../delivery/events";
import type { NotificationFormatter } from "../../../delivery/NotificationFormatter";
import type { SmtpPayload } from "../payload";
import type { EmailTemplates } from "../services/EmailTemplates";

export interface HandlebarsEmailFormatterOptions {
  subjectTemplate?: string;
  htmlTemplate?: string;
  cssTemplate?: string;
  plaintextTemplate?: string;
}

/**
 * Renders `templates/email/<notificationType>/{subject,html,plaintext}
 * .handlebars` with the context buildContext() returns. `css.handlebars`
 * is optional; the HTML layout includes it as the `templateCss` partial.
 * Attachments: the templates' inline images plus `attachments` in the
 * built context.
 */
export abstract class HandlebarsEmailFormatter<
  T extends NotificationContext,
  C extends object,
> implements NotificationFormatter<SmtpNotificationEvent<T>, SmtpPayload> {
  protected readonly logger = new Logger(this.constructor.name);

  private readonly subjectTemplate: string;
  private readonly htmlTemplate: string;
  private readonly cssTemplate: string;
  private readonly plaintextTemplate: string;

  constructor(
    notificationType: string,
    protected readonly templates: EmailTemplates,
    options: HandlebarsEmailFormatterOptions = {},
  ) {
    const template = (name: string) =>
      `email/${notificationType}/${name}.handlebars`;
    this.subjectTemplate = options.subjectTemplate ?? template("subject");
    this.htmlTemplate = options.htmlTemplate ?? template("html");
    this.cssTemplate = options.cssTemplate ?? template("css");
    this.plaintextTemplate = options.plaintextTemplate ?? template("plaintext");
  }

  abstract buildContext(context: T): Promise<C>;

  async formatNotification(
    notification: SmtpNotificationEvent<T>,
  ): Promise<SmtpPayload> {
    const context = await this.buildContext(notification.context);
    const subject = this.templates.get(this.subjectTemplate);
    const html = this.templates.get(this.htmlTemplate);
    const plaintext = this.templates.get(this.plaintextTemplate);
    const css = this.templates.find(this.cssTemplate);

    const contextAttachments =
      "attachments" in context && Array.isArray(context.attachments)
        ? (context.attachments as Attachment[])
        : [];

    return {
      subject: subject.render(context),
      htmlPart: html.render(context, {
        partials: css ? { templateCss: css.render } : {},
      }),
      plaintextPart: plaintext.render(context),
      attachments: [...html.attachments, ...contextAttachments],
    };
  }
}
