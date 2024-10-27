import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable } from "@nestjs/common";
import { ConsumeMessage } from "amqplib";
import { PathLike } from "fs";
import * as fs from "fs";
import path from "path";
import { DPVMetadataExtractor } from "../ingest/dpvMetadataExtractor";
import { IngestError } from "../ingest/ingestError";
import { LocalMetadataExtractor } from "../ingest/localMetadataExtractor";
import { MetadataExtractor } from "../ingest/metadataExtractor";
import { PHMetadataExtractor } from "../ingest/phMetadataExtractor";
import { XHetadataExtractor } from "../ingest/xhMetadataExtractor";
import { XVMetadataExtractor } from "../ingest/xvMetadataExtractor";
import {
  ASSETS_JOB_PREFIX,
  JOB_TYPE_PREFIX,
  TRIGGER_SUFFIX,
  USER_AGENT,
} from "../util/constants";
import axios from "axios";
import { parse } from "node-html-parser";
import { downloadSegments } from "../workflow/download";
import { AssetWorkflow } from "../workflow/workflow";

@Injectable()
export class RawIngestionHandler {
  @RabbitSubscribe({
    exchange: `${ASSETS_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${ASSETS_JOB_PREFIX}.rawIngest.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.rawIngest`,
  })
  public async handle(msg: any, amqlMsg: ConsumeMessage) {
    console.log(msg);

    const metadataHandler = this.getMetadataHandler(msg.assetLocation);
    const tempDirPath = path.join(
      process.env.ASSET_DOWNLOAD_DIR!,
      metadataHandler.id
    );
    let processWorkflow = true;

    if (msg.skipWorkflow && Boolean(msg.skipWorkflow)) {
      processWorkflow = false;
    }

    try {
      fs.mkdirSync(tempDirPath);
      let rawAsset: PathLike;
      let name: string;
      let workDir: PathLike;

      if (!metadataHandler.isLocal()) {
        const response = await axios.get(metadataHandler.url, {
          headers: {
            "User-Agent": USER_AGENT,
            "Accept-Language": "en-US,en;q=0.9",
          },
        });

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

        rawAsset = await downloadSegments({
          workDir: tempDirPath,
          segmentUrls: segmentUrls,
          title: title,
        });

        workDir = path.join(tempDirPath, "ingest");
        fs.mkdirSync(workDir);
      } else {
        rawAsset = msg.assetLocation;
        name = await metadataHandler.getTitle("");
        workDir = tempDirPath;
      }

      console.log(name);

      if (processWorkflow) {
        const workflow = new AssetWorkflow(
          metadataHandler.id,
          rawAsset,
          workDir,
          "local"
        );
        await workflow.start();
      } else {
        fs.renameSync(
          `${tempDirPath}/${name}.mp4`,
          `${process.env.ASSETS_DIR}/unprocessed/${name}.mp4`
        );
      }
    } catch {
      return;
    } finally {
      try {
        if (fs.existsSync(tempDirPath)) {
          fs.rmSync(tempDirPath, { recursive: true });
        }
      } catch (e) {
        console.error(
          `An error has occurred while removing the temp folder at ${tempDirPath}. Please remove it manually. Error: ${e}`
        );
      }
    }
  }

  getMetadataHandler(url: string): MetadataExtractor {
    if (url.startsWith("/")) {
      return new LocalMetadataExtractor(url);
    }

    const parsed = new URL(url);
    const host = parsed.host.toLowerCase();

    if (host.includes("xvideos.com")) {
      return new XVMetadataExtractor(url);
    } else if (host.includes("pornhub.com")) {
      return new PHMetadataExtractor(url);
    } else if (host.includes("xhamster.com")) {
      return new XHetadataExtractor(url);
    } else if (host.includes("dp-vids.com")) {
      return new DPVMetadataExtractor(url);
    }

    throw new IngestError(`No metadata handler found for host ${parsed.host}`);
  }
}
