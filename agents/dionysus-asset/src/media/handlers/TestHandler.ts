import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { mediaConfig } from "../../config/configuration";
import type { MediaConfigType } from "../../config/configuration";
import { MEDIA_SUBSCRIPTIONS } from "../../messaging";
import { MediaWorkflows } from "../services/MediaWorkflows";

/** A manual SFTP upload test (marked for deletion). */
@Injectable()
export class TestHandler {
  private readonly logger = new Logger(TestHandler.name);

  constructor(
    @Inject(mediaConfig.KEY) private readonly media: MediaConfigType,
    private readonly workflows: MediaWorkflows,
  ) {}

  @RabbitSubscribe(MEDIA_SUBSCRIPTIONS.test)
  public async handle(_msg: unknown): Promise<void> {
    const workflowId = "386e15d2-c124-4c30-a966-ed2c2ae9579c";
    try {
      const workflow = this.workflows.open(workflowId, "mp4", "transcode");

      await workflow.upload(
        {
          "transcodeMetadata.json": `/Dionysus/metadata/movie/45745/metadata.json`,
        },
        {
          host: this.media.cdn.host,
          port: 22,
          username: this.media.cdn.username!,
          password: this.media.cdn.password!,
        },
        async (progress, bytesTransferred) => {
          this.logger.debug(
            `Progress: ${progress} - Bytes transferred: ${bytesTransferred}`,
          );
        },
      );
    } catch (e) {
      this.logger.error(e instanceof Error ? e.stack : String(e));
    }
  }
}
