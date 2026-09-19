import type { NotificationContext } from "@ncfritz/olympus-sdk/olympus";
import { Logger } from "@nestjs/common";
import * as handlebars from "handlebars";
import Handlebars from "handlebars";
import helpers from "handlebars-helpers";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Attachment } from "nodemailer/lib/mailer";
import type { SmtpNotificationEvent } from "../../../delivery/events";
import type { NotificationFormatter } from "../../../delivery/NotificationFormatter";
import type { SmtpPayload } from "../payload";

export interface HandlebarsEmailFormatterOptions {
  subjectTemplate?: string;
  htmlTemplate?: string;
  cssTemplate?: string;
  plaintextTemplate?: string;
}

/**
 * Renders `templates/email/<notificationType>/{subject,html,css,plaintext}
 * .handlebars` with the context buildContext() returns, using the partials
 * in `templates/partials/email`. `<template>.attachments.json` next to a
 * template or partial lists inline images (paths relative to the package).
 */
export abstract class HandlebarsEmailFormatter<
  T extends NotificationContext,
  C extends object,
> implements NotificationFormatter<SmtpNotificationEvent<T>, SmtpPayload> {
  protected readonly logger = new Logger(this.constructor.name);

  private readonly htmlTemplate: string;
  private readonly cssTemplate: string;
  private readonly plaintextTemplate: string;
  private readonly subjectTemplate: string;

  private partialsLoaded = false;
  private partialAttachments: Record<string, Attachment[]> = {};

  constructor(
    notificationType: string,
    /** The package's templates/ directory (findTemplatesDir()). */
    protected readonly templatesDir: string,
    options?: HandlebarsEmailFormatterOptions,
  ) {
    this.htmlTemplate =
      options?.htmlTemplate || `email/${notificationType}/html.handlebars`;
    this.cssTemplate =
      options?.htmlTemplate || `email/${notificationType}/css.handlebars`;
    this.plaintextTemplate =
      options?.plaintextTemplate ||
      `email/${notificationType}/plaintext.handlebars`;
    this.subjectTemplate =
      options?.subjectTemplate ||
      `email/${notificationType}/subject.handlebars`;
  }

  abstract buildContext(notification: T): Promise<C>;

  async formatNotification(
    notification: SmtpNotificationEvent<T>,
  ): Promise<SmtpPayload> {
    const context = await this.buildContext(notification.context);
    const attachments: Attachment[] = [];

    this.loadPartials();

    const subjectRenderer = this.buildTemplate(this.subjectTemplate);
    const htmlRenderer = this.buildTemplate(this.htmlTemplate);
    const plaintextRenderer = this.buildTemplate(this.plaintextTemplate);

    // Process attachments - first add any attachment from the HTML handler.  Then find any partials actually
    // used in the template/partial chain and attach any associated attachments.
    for (const attachment of htmlRenderer[1]) {
      attachments.push(attachment);
    }

    // Only check attachments for the HTML renderer.  The subject and plaintext should not have attachments.
    // See https://stackoverflow.com/questions/40445476/getting-a-list-of-partials-actually-used-in-handlebars-template-compile
    // for why we do things this way.
    for (const partialName in handlebars.partials) {
      const partial = handlebars.partials[partialName];

      if (typeof partial === "function") {
        for (const attachment of this.partialAttachments[partialName]) {
          attachments.push(attachment);
        }
      }
    }

    // If the context is an AttachmentAwareMessageContext add the attachments from the context.
    if (
      context &&
      typeof context === "object" &&
      "attachments" in context &&
      Array.isArray(context.attachments) &&
      context.attachments?.length > 0
    ) {
      for (const attachment of context.attachments) {
        attachments.push(attachment);
      }
    }

    return {
      subject: subjectRenderer[0](context),
      htmlPart: htmlRenderer[0](context, {
        partials: {
          templateCss: this.loadInternal(
            path.join(this.templatesDir, this.cssTemplate),
            true,
          )[0],
        },
      }),
      plaintextPart: plaintextRenderer[0](context),
      attachments: attachments,
    };
  }

  private buildTemplate(
    template: string,
  ): [HandlebarsTemplateDelegate, Attachment[]] {
    const templatePath = path.join(this.templatesDir, template);

    this.logger.debug(`Loading template ${templatePath}`);

    return this.loadInternal(templatePath);
  }

  private loadInternal(
    p: string,
    failSilently: boolean = false,
  ): [HandlebarsTemplateDelegate, Attachment[]] {
    if (!fs.existsSync(p) && !failSilently) {
      throw `No template exists at ${p}`;
    }

    try {
      const templatePath = path.parse(p);
      const templateAttachmentsMetadataPath = `${templatePath.dir}/${templatePath.name}.attachments.json`;
      const attachments: Attachment[] = [];

      if (fs.existsSync(templateAttachmentsMetadataPath)) {
        const attachmentMetadata = JSON.parse(
          fs.readFileSync(templateAttachmentsMetadataPath).toString("utf-8"),
        );

        if (attachmentMetadata.attachments) {
          for (const attachment of attachmentMetadata.attachments) {
            attachments.push(this.resolveAttachment(attachment));
          }
        }
      }

      return [
        Handlebars.compile(fs.readFileSync(p).toString("utf-8")),
        attachments,
      ];
    } catch (e) {
      this.logger.error(
        "Unable to apply Handlebars template",
        e instanceof Error ? e.stack : String(e),
      );
      throw e;
    }
  }

  private loadPartials() {
    if (this.partialsLoaded) {
      this.logger.debug("All partials loaded, nothing to do.");

      //return;
    }

    this.logger.debug("Registering handlebars-helpers");
    Handlebars.registerHelper(helpers());

    this.logger.debug("Loading partials...");

    for (const partial of fs.readdirSync(
      path.join(this.templatesDir, "partials", "email"),
    )) {
      const partialPath = path.join(
        this.templatesDir,
        "partials",
        "email",
        partial,
      );
      const partialName = path.parse(partial).name;

      this.logger.debug(`Loading partial from ${partialPath}`);

      const [compiledPartial, attachments] = this.loadInternal(partialPath);

      Handlebars.registerPartial(partialName, compiledPartial);
      this.partialAttachments[partialName] = attachments;
    }

    this.partialsLoaded = true;
  }

  /** Attachment files are listed relative to the package root. */
  protected resolveAttachment(attachment: Attachment): Attachment {
    return typeof attachment.path === "string" &&
      !path.isAbsolute(attachment.path)
      ? {
          ...attachment,
          path: path.join(path.dirname(this.templatesDir), attachment.path),
        }
      : attachment;
  }
}
