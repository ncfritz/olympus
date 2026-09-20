import axios from "axios";
import * as path from "node:path";
import type { Attachment } from "nodemailer/lib/mailer";
import type { MediaApi } from "@ncfritz/olympus-client";
import type {
  DionysusTranscodeWorkflowCompleteContext,
  DionysusTranscodeWorkflowCompleteMessageContext,
} from "../../../delivery/contexts/dionysus";
import type { EmailTemplates } from "../services/EmailTemplates";
import { HandlebarsEmailFormatter } from "./HandlebarsEmailFormatter";

/**
 * dionysus_transcode_complete: the workflow, with the TMDB poster attached
 * inline (or one of six placeholder posters when there is none).
 */
export class TranscodeWorkflowCompleteEmailFormatter extends HandlebarsEmailFormatter<
  DionysusTranscodeWorkflowCompleteContext,
  DionysusTranscodeWorkflowCompleteMessageContext
> {
  constructor(
    private readonly mediaApi: MediaApi,
    templates: EmailTemplates,
  ) {
    super("dionysus_transcode_complete", templates);
  }

  async buildContext(
    context: DionysusTranscodeWorkflowCompleteContext,
  ): Promise<DionysusTranscodeWorkflowCompleteMessageContext> {
    const workflow = await this.mediaApi.describeMediaAssetWorkflow(
      context.workflowId,
    );

    const posterAttachment: Attachment = {
      cid: "media_poster",
      path: path.join(
        this.templates.dir,
        "images",
        `no_poster_${Math.floor(Math.random() * 6) + 1}.png`,
      ),
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
        this.logger.warn(
          `Unable to fetch poster for workflow ${context.workflowId}: ${String(e)}`,
        );
      }
    }

    return { workflow, attachments: [posterAttachment] };
  }
}
