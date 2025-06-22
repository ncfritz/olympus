import {
  NotificationContext,
  SMTPDestinationEvent,
  SMTPPayload,
} from "@ncfritz/olympus-model/dist/notifications";
import * as handlebars from "handlebars";
import * as fs from "node:fs";
import * as path from "node:path";
import { Attachment } from "nodemailer/lib/mailer";
import { logger } from "../util/logger";
import { NotificationFormatter } from "./formatter";
import Handlebars from "handlebars";

export interface SMTPHandleBarsFormatterOptions {
  subjectTemplate?: string;
  htmlTemplate?: string;
  plaintextTemplate?: string;
}

export class SMTPHandleBarsFormatter<T extends NotificationContext>
  implements NotificationFormatter<SMTPDestinationEvent<T>, SMTPPayload>
{
  private readonly htmlTemplate: string;
  private readonly plaintextTemplate: string;
  private readonly subjectTemplate: string;

  private partialsLoaded = false;
  private partialAttachments: Record<string, Attachment[]> = {};

  constructor(
    notificationType: string,
    options?: SMTPHandleBarsFormatterOptions,
  ) {
    this.htmlTemplate =
      options?.htmlTemplate || `email/${notificationType}/html.handlebars`;
    this.plaintextTemplate =
      options?.plaintextTemplate ||
      `email/${notificationType}/plaintext.handlebars`;
    this.subjectTemplate =
      options?.subjectTemplate ||
      `email/${notificationType}/subject.handlebars`;
  }

  async formatNotification(
    notification: SMTPDestinationEvent<T>,
  ): Promise<SMTPPayload> {
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

    return {
      subject: subjectRenderer[0](notification.context),
      htmlPart: htmlRenderer[0](notification.context),
      plaintextPart: plaintextRenderer[0](notification.context),
      attachments: attachments,
    };
  }

  private buildTemplate(
    template: string,
  ): [HandlebarsTemplateDelegate, Attachment[]] {
    const templatePath = `./templates/${template}`;

    logger.debug(`Loading template ${templatePath}`);

    return this.loadInternal(templatePath);
  }

  private loadInternal(p: string): [HandlebarsTemplateDelegate, Attachment[]] {
    if (!fs.existsSync(p)) {
      throw "fff";
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
            attachments.push(attachment);
          }
        }
      }

      return [
        Handlebars.compile(fs.readFileSync(p).toString("utf-8")),
        attachments,
      ];
    } catch (e) {
      logger.error("Unable to apply Handlebars template", e);
      throw e;
    }
  }

  private loadPartials() {
    if (this.partialsLoaded) {
      logger.debug("All partials loaded, nothing to do.");

      //return;
    }

    logger.debug("Loading partials...");

    for (const partial of fs.readdirSync("./templates/partials/email")) {
      const partialPath = `./templates/partials/email/${partial}`;
      const partialName = path.parse(partial).name;

      logger.debug(`Loading partial from ${partialPath}`);

      const [compiledPartial, attachments] = this.loadInternal(partialPath);

      Handlebars.registerPartial(partialName, compiledPartial);
      this.partialAttachments[partialName] = attachments;
    }

    this.partialsLoaded = true;
  }
}
