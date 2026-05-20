import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable } from "@nestjs/common";
import { type ConsumeMessage } from "amqplib";
import {
  JOB_TYPE_PREFIX,
  MEDIA_JOB_PREFIX,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import { MediaWorkflow } from "../../workflow/media/workflow";

@Injectable()
export class TestHandler {
  @RabbitSubscribe({
    exchange: `${MEDIA_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${MEDIA_JOB_PREFIX}.test.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.test`,
  })
  public async handle(msg: any, amqMsg: ConsumeMessage) {
    const workflowId = "386e15d2-c124-4c30-a966-ed2c2ae9579c";
    try {
      const workflow = new MediaWorkflow(workflowId, "mp4", "transcode");

      await workflow.upload(
        {
          "transcodeMetadata.json": `/Dionysus/metadata/movie/45745/metadata.json`,
        },
        {
          host: process.env.DIONYSUS_CDN_SSH_HOST!,
          port: 22,
          username: process.env.DIONYSUS_CDN_SSH_USERNAME!,
          password: process.env.DIONYSUS_CDN_SSH_PASSWORD!,
        },
        async (progress, bytesTransferred) => {
          console.log(
            `Progress: ${progress} - Bytes transferred: ${bytesTransferred}`,
          );
        },
      );
    } catch (e) {
      console.error(e);
    }
  }
}
