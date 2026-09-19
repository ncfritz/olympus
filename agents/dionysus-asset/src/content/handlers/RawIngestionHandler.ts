import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { HttpService } from "@nestjs/axios";
import { Inject, Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import { PathLike } from "fs";
import moment from "moment";
import { parse } from "node-html-parser";
import path from "path";
import { firstValueFrom } from "rxjs";
import { v4 as uuidv4 } from "uuid";
import { ContentApi } from "../../api/ContentApi";
import { contentConfig } from "../../config/configuration";
import type { ContentConfigType } from "../../config/configuration";
import {
  CONTENT_SUBSCRIPTIONS,
  type RawIngestionMessage,
} from "../../messaging";
import { IngestError } from "../../tools/errors/IngestError";
import { DpvMetadataExtractor } from "../extractors/DpvMetadataExtractor";
import { LocalMetadataExtractor } from "../extractors/LocalMetadataExtractor";
import type { MetadataExtractor } from "../extractors/MetadataExtractor";
import { PhMetadataExtractor } from "../extractors/PhMetadataExtractor";
import { XhMetadataExtractor } from "../extractors/XhMetadataExtractor";
import { XvMetadataExtractor } from "../extractors/XvMetadataExtractor";
import { AssetWorkflows } from "../services/AssetWorkflows";
import { ContentReporter } from "../services/ContentReporter";
import { DuplicateError } from "../services/DuplicateError";
import { downloadSegments } from "../services/segments";
import { USER_AGENT } from "../services/userAgent";

/**
 * Ingests a content asset from a local file or a supported page: downloads
 * the page's video (through the proxy) and runs the asset workflow, or
 * files it as unprocessed.
 */
@Injectable()
export class RawIngestionHandler {
  private readonly logger = new Logger(RawIngestionHandler.name);

  constructor(
    @Inject(contentConfig.KEY) private readonly content: ContentConfigType,
    private readonly httpService: HttpService,
    private readonly contentApi: ContentApi,
    private readonly reporter: ContentReporter,
    private readonly assetWorkflows: AssetWorkflows,
  ) {}

  @RabbitSubscribe(CONTENT_SUBSCRIPTIONS.rawIngest)
  public async handle(msg: RawIngestionMessage): Promise<void> {
    this.logger.debug("Received input message:", msg);

    let ingestionWorkflow;

    if (!msg.workflowId) {
      this.logger.log("No workflow ID found, discarding message...");
      return;
    } else {
      try {
        ingestionWorkflow =
          await this.contentApi.describeContentIngestionWorkflow(
            msg.workflowId,
          );

        if (ingestionWorkflow.status === "queued") {
          await this.contentApi.updateContentIngestionWorkflow(
            ingestionWorkflow.id,
            {
              status: "running",
              startedTime: moment().utc().toISOString(),
            },
          );
        } else {
          this.logger.log(
            `Workflow ${ingestionWorkflow.id} is not in QUEUED state, skipping...`,
          );
          return;
        }
      } catch (e) {
        this.logger.error(
          "Unable to fetch or update workflow... message will be skipped",
          e,
        );
        return;
      }
    }

    const id = uuidv4();
    const tempDirPath = path.join(this.content.downloadDir!, id);
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
        this.logger.log("Asset is on local filesystem...");

        rawAsset = msg.assetLocation;
        name = await metadataHandler.getTitle("");
        workDir = tempDirPath;
      } else {
        this.logger.log(`Asset is remote: ${metadataHandler.url}`);

        const downloadStep = await this.reporter.createStep(
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
            this.reporter,
          );

          workDir = path.join(tempDirPath, "ingest");
          fs.mkdirSync(workDir);

          await this.reporter.updateStepStatus(
            ingestionWorkflow!.id,
            downloadStep.id,
            "success",
          );
        } catch (e) {
          this.logger.error(
            `Error while downloading asset: ${msg.assetLocation}`,
            e,
          );

          await this.reporter.updateStepStatus(
            ingestionWorkflow!.id,
            downloadStep.id,
            "failed",
          );

          throw new IngestError("Unable to download or locate input asset", e);
        }
      }

      this.logger.log(`Extracted asset name: ${name}`);

      if (processWorkflow) {
        const workflow = this.assetWorkflows.open({
          id: ingestionWorkflow!.id,
          input: rawAsset,
          workDir: workDir,
          mode: "local",
          originalFilename: msg.originalFilename,
          ingestWorkflow: ingestionWorkflow!,
        });
        await workflow.start();
        await this.reporter.updateWorkflowStatus(
          ingestionWorkflow!.id,
          "success",
        );
      } else {
        fs.renameSync(
          `${tempDirPath}/${name}.mp4`,
          `${this.content.assetsDir}/unprocessed/${name}.mp4`,
        );

        await this.reporter.updateWorkflowStatus(
          ingestionWorkflow!.id,
          "skipped",
        );
      }
    } catch (e) {
      this.logger.error("Unable process asset ingest:", e);

      if (e instanceof DuplicateError) {
        await this.reporter.updateWorkflowStatus(
          ingestionWorkflow!.id,
          "duplicate",
        );
      } else {
        await this.reporter.updateWorkflowStatus(
          ingestionWorkflow!.id,
          "failed",
        );
      }

      return;
    } finally {
      try {
        if (tempDirPath && fs.existsSync(tempDirPath)) {
          fs.rmSync(tempDirPath, { recursive: true });
        }
      } catch (e) {
        this.logger.error(
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
      return new XvMetadataExtractor(this.httpService, url, id);
    } else if (host.includes("pornhub.com")) {
      return new PhMetadataExtractor(this.httpService, url, id);
    } else if (host.includes("xhamster.com")) {
      return new XhMetadataExtractor(this.httpService, url, id);
    } else if (host.includes("dp-vids.com")) {
      return new DpvMetadataExtractor(this.httpService, url, id);
    }

    throw new IngestError(`No metadata handler found for host ${parsed.host}`);
  }
}
