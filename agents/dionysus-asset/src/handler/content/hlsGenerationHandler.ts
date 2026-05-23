import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable } from "@nestjs/common";
import type { ConsumeMessage } from "amqplib";
import * as cliProgress from "cli-progress";
import Ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import contentApi from "../../api/contentApi";
import type { HlsGenerationMessage } from "../../types/messages";
import {
  ASSETS_JOB_PREFIX,
  JOB_TYPE_PREFIX,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import { logger } from "../../util/logger";
import * as ffmpegOnProgress from "ffmpeg-on-progress";

@Injectable()
export class HlsGenerationAssetHandler {
  @RabbitSubscribe({
    exchange: `${ASSETS_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${ASSETS_JOB_PREFIX}.hls.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.hls`,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: HlsGenerationMessage, amqMsg: ConsumeMessage) {
    logger.info(msg);

    const assetId = msg.assetId;
    const assetsDir = process.env.ASSETS_DIR;
    const assetFile = `${assetsDir}/${assetId}/asset.mp4`;
    const playlistFile = `${assetsDir}/${assetId}/playlist.m3u8`;
    const metadataFile = `${assetsDir}/${assetId}/metadata.json`;
    const segmentsDir = `${assetsDir}/${assetId}/segments`;
    const tmpDir = `${process.env.TEMP_DIR}/${assetId}-hls`;

    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }

    logger.info("Starting Job - Details...");
    logger.info(`\tassetId: ${assetId}`);
    logger.info(`\tassetsDir: ${assetsDir}`);
    logger.info(`\tassetFile: ${assetFile}`);
    logger.info(`\tplaylistFile: ${playlistFile}`);
    logger.info(`\tmetadataFile: ${metadataFile}`);
    logger.info(`\tsegmentsDir: ${segmentsDir}`);
    logger.info(`\ttmpDir: ${tmpDir}`);

    if (!fs.existsSync(assetFile) || !fs.existsSync(metadataFile)) {
      logger.error("Missing asset file or asset metadata... aborting!");
      return;
    }

    try {
      logger.info(`Checking for tmp existence: ${tmpDir}`);
      if (fs.existsSync(tmpDir)) {
        logger.info("Removing existing tmp dir");
        fs.rmSync(tmpDir, { recursive: true });
      }

      logger.info(`Creating tmp dir: ${tmpDir}`);
      fs.mkdirSync(tmpDir);
      fs.mkdirSync(`${tmpDir}/segments`);

      logger.info("Loading asset metadata...");
      const md = JSON.parse(fs.readFileSync(metadataFile).toString("utf-8"));
      const duration = md.format.duration;
      logger.info(`Asset duration: ${duration}`);

      await new Promise<void>((resolve, reject) => {
        logger.info("\nTranscode content...");

        const progress = new cliProgress.SingleBar(
          {},
          cliProgress.Presets.rect,
        );
        progress.start(100, 0);

        const command = Ffmpeg(assetFile);
        command.videoCodec("copy");
        command.audioCodec("copy");
        command.addOptions([
          "-start_number 0",
          "-hls_time 4",
          "-hls_list_size 0",
          "-f hls",
          `-hls_segment_filename ${tmpDir}/segments/segment%03d.ts`,
          "-hls_base_url segments/",
        ]);
        command.output(`${tmpDir}/playlist.m3u8`);
        command.on("error", function (err, stdout, stderr) {
          logger.error("Error encountered!", err);

          progress.stop();
          reject(err);
        });
        command.on("start", function (commandLine: string) {
          logger.debug(`Spawned Ffmpeg with command: ${commandLine}`);
        });
        command.on("end", async function () {
          progress.stop();

          logger.info("Tagging asset");
          await contentApi.addContentAssetTag(assetId, "video.hls", "system");

          if (fs.existsSync(segmentsDir)) {
            logger.warn("Found existing segments directory, cleaning up...");
            fs.rmSync(segmentsDir, { recursive: true });
          }

          if (fs.existsSync(playlistFile)) {
            logger.warn("Found existing playlist file, cleaning up...");
            fs.rmSync(playlistFile);
          }

          fs.mkdirSync(segmentsDir);

          logger.info("Copying segments to asset destination");
          fs.cpSync(`${tmpDir}/segments`, segmentsDir, { recursive: true });

          logger.info("Copying playlist to asset destination");
          fs.cpSync(`${tmpDir}/playlist.m3u8`, playlistFile);

          resolve();
        });
        command.on(
          "progress",
          ffmpegOnProgress((p: number, e: any) => {
            progress.update(Math.trunc(p * 100));
          }, duration),
        );
        command.run();
      });
    } finally {
      logger.info("Cleaning up...");
      fs.rmSync(tmpDir, { recursive: true });
    }
  }
}
