import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import type { ConsumeMessage } from "amqplib";
import { PathLike } from "fs";
import * as fs from "fs";
import moment from "moment";
import path from "path";
import { firstValueFrom } from "rxjs";
import contentApi from "../../api/contentApi";
import { DuplicateError } from "../../error/duplicateError";
import { DPVMetadataExtractor } from "../../ingest/dpvMetadataExtractor";
import { IngestError } from "../../error/ingestError";
import { LocalMetadataExtractor } from "../../ingest/localMetadataExtractor";
import { MetadataExtractor } from "../../ingest/metadataExtractor";
import { PHMetadataExtractor } from "../../ingest/phMetadataExtractor";
import { XHMetadataExtractor } from "../../ingest/xhMetadataExtractor";
import { XVMetadataExtractor } from "../../ingest/xvMetadataExtractor";
import type { RawIngestionMessage } from "../../types/messages";
import {
  ASSETS_JOB_PREFIX,
  JOB_TYPE_PREFIX,
  TRIGGER_SUFFIX,
  USER_AGENT,
} from "../../util/constants";
import { parse } from "node-html-parser";
import { logger } from "../../util/logger";
import { downloadSegments } from "../../workflow/content/download";
import {
  createStep,
  updateStepStatus,
  updateWorkflowStatus,
} from "../../workflow/content/reporter";
import { AssetWorkflow } from "../../workflow/content/workflow";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class RawIngestionHandler {
  constructor(private readonly httpService: HttpService) {
    this.httpService = httpService;
  }

  @RabbitSubscribe({
    exchange: `${ASSETS_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${ASSETS_JOB_PREFIX}.rawIngest.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.rawIngest`,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: RawIngestionMessage, amqMsg: ConsumeMessage) {
    logger.debug("Received input message:", msg);

    let ingestionWorkflow;

    if (!msg.workflowId) {
      logger.info("No workflow ID found, discarding message...");
      return;
    } else {
      try {
        ingestionWorkflow = await contentApi.describeContentIngestionWorkflow(
          msg.workflowId,
        );

        if (ingestionWorkflow.status === "queued") {
          await contentApi.updateContentIngestionWorkflow(
            ingestionWorkflow.id,
            {
              status: "running",
              startedTime: moment().utc().toISOString(),
            },
          );
        } else {
          logger.info(
            `Workflow ${ingestionWorkflow.id} is not in QUEUED state, skipping...`,
          );
          return;
        }
      } catch (e) {
        logger.error(
          "Unable to fetch or update workflow... message will be skipped",
          e,
        );
        return;
      }
    }

    const id = uuidv4();
    const tempDirPath = path.join(process.env.CONTENT_ASSETS_DOWNLOAD_DIR!, id);
    const processWorkflow = !(msg.skipWorkflow && Boolean(msg.skipWorkflow));

    try {
      const metadataHandler = this.getMetadataHandler(msg.assetLocation, id);

      if (!fs.existsSync(tempDirPath)) {
        fs.mkdirSync(tempDirPath);
      }

      let rawAsset: PathLike;
      let name: string;
      let workDir: PathLike;

      if (metadataHandler.isLocal()) {
        logger.info("Asset is on local filesystem...");

        rawAsset = msg.assetLocation;
        name = await metadataHandler.getTitle("");
        workDir = tempDirPath;
      } else {
        logger.info(`Asset is remote: ${metadataHandler.url}`);

        const downloadStep = await createStep(
          ingestionWorkflow!.id,
          "download",
        );

        try {
          const response = await firstValueFrom(
            this.httpService.get(metadataHandler.url, {
              headers: {
                "User-Agent": USER_AGENT,
                "Accept-Language": "en-US,en;q=0.9",
              },
            }),
          );

          const root = parse(response.data);

          let title = await metadataHandler.getTitle(root);
          title = title.trim();
          title = title
            .replace(/[^a-z0-9\-_+|\\u[a-z0-9]{4}]/gi, "-")
            .replace(/\s+/g, "-")
            .replace(/\/+/g, "-")
            .toLowerCase();
          name = title;

          const segmentUrls = await metadataHandler.getSegmentUrls(root);

          rawAsset = await downloadSegments(
            {
              workDir: tempDirPath,
              segmentUrls: segmentUrls,
              title: title,
            },
            ingestionWorkflow!,
            downloadStep,
          );

          workDir = path.join(tempDirPath, "ingest");
          fs.mkdirSync(workDir);

          await updateStepStatus(
            ingestionWorkflow!.id,
            downloadStep.id,
            "success",
          );
        } catch (e) {
          logger.error(
            `Error while downloading asset: ${msg.assetLocation}`,
            e,
          );

          await updateStepStatus(
            ingestionWorkflow!.id,
            downloadStep.id,
            "failed",
          );

          throw new IngestError("Unable to download or locate input asset", e);
        }
      }

      logger.info(`Extracted asset name: ${name}`);

      if (processWorkflow) {
        const workflow = new AssetWorkflow({
          id: ingestionWorkflow!.id,
          input: rawAsset,
          workDir: workDir,
          mode: "local",
          originalFilename: msg.originalFilename,
          ingestWorkflow: ingestionWorkflow!,
        });
        await workflow.start();
        await updateWorkflowStatus(ingestionWorkflow!.id, "success");
      } else {
        fs.renameSync(
          `${tempDirPath}/${name}.mp4`,
          `${process.env.CONTENT_ASSETS_DIR}/unprocessed/${name}.mp4`,
        );

        await updateWorkflowStatus(ingestionWorkflow!.id, "skipped");
      }
    } catch (e) {
      logger.error("Unable process asset ingest:", e);

      if (e instanceof DuplicateError) {
        await updateWorkflowStatus(ingestionWorkflow!.id, "duplicate");
      } else {
        await updateWorkflowStatus(ingestionWorkflow!.id, "failed");
      }

      return;
    } finally {
      try {
        if (tempDirPath && fs.existsSync(tempDirPath)) {
          fs.rmSync(tempDirPath, { recursive: true });
        }
      } catch (e) {
        logger.error(
          `An error has occurred while removing the temp folder at ${tempDirPath}. Please remove it manually.`,
          e,
        );
      }
    }
  }

  getMetadataHandler(url: string, id: string): MetadataExtractor {
    if (url.startsWith("/")) {
      return new LocalMetadataExtractor(this.httpService, url, id);
    }

    const parsed = new URL(url);
    const host = parsed.host.toLowerCase();

    if (host.includes("xvideos.com")) {
      return new XVMetadataExtractor(this.httpService, url, id);
    } else if (host.includes("pornhub.com")) {
      return new PHMetadataExtractor(this.httpService, url, id);
    } else if (host.includes("xhamster.com")) {
      return new XHMetadataExtractor(this.httpService, url, id);
    } else if (host.includes("dp-vids.com")) {
      return new DPVMetadataExtractor(this.httpService, url, id);
    }

    throw new IngestError(`No metadata handler found for host ${parsed.host}`);
  }
}
