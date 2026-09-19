import axios from "axios";
import { Attachment } from "nodemailer/lib/mailer";
import mediaApi from "../../api/mediaApi";
import {
  BaseDestinationEvent,
  WebSocketDestinationEvent,
} from "../../types/destinations";
import {
  DionysusTranscodeWorkflowCompleteContext,
  DionysusTranscodeWorkflowCompleteMessageContext,
} from "../../types/dionysus";
import { WebSocketPayload } from "../../types/payloads";
import { logger } from "../../util/logger";
import { NotificationFormatter } from "../formatter";
import { SMTPHandleBarsFormatter } from "../smtpHandlebarsFormatter";

export class TranscodeWorkflowCompleteWebsocketFormatter extends NotificationFormatter<
  BaseDestinationEvent<DionysusTranscodeWorkflowCompleteContext>,
  WebSocketPayload
> {
  async formatNotification(
    notification: WebSocketDestinationEvent<DionysusTranscodeWorkflowCompleteContext>,
  ): Promise<WebSocketPayload> {
    return {
      type: "context",
      value: notification.context,
    };
  }
}

export class TranscodeWorkflowCompleteSmtpFormatter extends SMTPHandleBarsFormatter<
  DionysusTranscodeWorkflowCompleteContext,
  DionysusTranscodeWorkflowCompleteMessageContext
> {
  constructor() {
    super("dionysus_transcode_complete");
  }

  async buildContext(
    context: DionysusTranscodeWorkflowCompleteContext,
  ): Promise<DionysusTranscodeWorkflowCompleteMessageContext> {
    const workflow = await mediaApi.describeMediaAssetWorkflow(
      context.workflowId,
    );

    const posterAttachment: Attachment = {
      cid: "media_poster",
      path: `templates/images/no_poster_${
        Math.floor(Math.random() * (6 - 1 + 1)) + 1
      }.png`,
      filename: "poster.png",
    };

    if (workflow.decoration.posterPath) {
      try {
        const posterResponse = await axios.get(
          `https://image.tmdb.org/t/p/w342${workflow.decoration.posterPath}`,
          { responseType: "arraybuffer" },
        );

        const posterExtension = workflow.decoration.posterPath.split(".").pop();

        delete posterAttachment.path;
        posterAttachment.filename = `poster.${posterExtension}`;
        posterAttachment.content = Buffer.from(
          posterResponse.data,
          "binary",
        ).toString("base64");
        posterAttachment.encoding = "base64";
      } catch (e) {
        logger.warn(
          `Unable to fetch poster for workflow ${context.workflowId}`,
          e,
        );
      }
    }

    return {
      workflow: workflow,
      attachments: [posterAttachment],
    };
  }
}
