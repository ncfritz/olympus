import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable } from "@nestjs/common";
import type { ConsumeMessage } from "amqplib";
import * as cliProgress from "cli-progress";
import Ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import * as path from "path";
import sharp, { OverlayOptions } from "sharp";
import type { ThumbnailGenerationMessage } from "../types/messages";
import { ts } from "../util/format";
import contentAssetsApi from "../api/contentAssets";
import {
  ASSETS_JOB_PREFIX,
  JOB_TYPE_PREFIX,
  TRIGGER_SUFFIX,
} from "../util/constants";
import { logger } from "../util/logger";

// eslint-disable-next-line @typescript-eslint/no-var-requires,@typescript-eslint/no-require-imports
const ffmpegOnProgress = require("ffmpeg-on-progress");

const DEFAULT_THUMB_INTERVAL = 5;
const DEFAULT_THUMB_WIDTH = 200;

@Injectable()
export class ThumbnailGenerationAssetHandler {
  @RabbitSubscribe({
    exchange: `${ASSETS_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${ASSETS_JOB_PREFIX}.thumbnail.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.thumbnail`,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: ThumbnailGenerationMessage, amqMsg: ConsumeMessage) {
    logger.info(msg);

    const assetId = msg.assetId;
    const assetsDir = process.env.ASSETS_DIR;
    const assetFile = `${assetsDir}/${assetId}/asset.mp4`;
    const metadataFile = `${assetsDir}/${assetId}/metadata.json`;
    const spriteFile = `${assetsDir}/${assetId}/sprite.jpg`;
    const thumbsFile = `${assetsDir}/${assetId}/thumbs.vtt`;
    const tmpDir = `${assetsDir}/tmp`;

    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }

    logger.info("Starting Job - Details...");
    logger.info(`\tassetId: ${assetId}`);
    logger.info(`\tassetsDir: ${assetsDir}`);
    logger.info(`\tassetFile: ${assetFile}`);
    logger.info(`\tmetadataFile: ${metadataFile}`);
    logger.info(`\tspriteFile: ${spriteFile}`);
    logger.info(`\tthumbsFile: ${thumbsFile}`);
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
      fs.mkdirSync(`${tmpDir}/screens`);

      logger.info("Loading asset metadata...");
      const md = JSON.parse(fs.readFileSync(metadataFile).toString("utf-8"));
      const duration = md.format.duration;
      const width = md.streams[0].width;
      const height = md.streams[0].height;
      const ratio = width / height;
      const thumbWidth = DEFAULT_THUMB_WIDTH;
      const thumbHeight = Math.ceil((1 / ratio) * DEFAULT_THUMB_WIDTH);

      logger.info("Asset details:");
      logger.info(`\tDuration: ${duration}s`);
      logger.info(`\tWidth: ${width}px`);
      logger.info(`\tHeight: ${height}px`);
      logger.info(`\tRatio: ${ratio}`);
      logger.info(`\tThumbsize: ${thumbWidth} x ${thumbHeight}`);

      await new Promise<void>((resolve, reject) => {
        logger.info("\nTranscode content...");

        const progress = new cliProgress.SingleBar(
          {},
          cliProgress.Presets.rect,
        );
        progress.start(100, 0);

        const command = Ffmpeg(assetFile);
        command.videoFilters([
          `fps=${1 / DEFAULT_THUMB_INTERVAL}`,
          `scale='min(${DEFAULT_THUMB_WIDTH}\\, iw):-1'`,
        ]);
        command.output(`${tmpDir}/screens/thumb%04d.png`);
        command.on("error", function (err, stdout, stderr) {
          logger.error("Error encountered!");
          logger.debug(stdout);
          logger.debug(stderr);

          progress.stop();
          reject(err);
        });
        command.on("start", function (commandLine: string) {
          logger.info(`Spawned Ffmpeg with command: ${commandLine}`);
        });
        command.on("end", async function () {
          progress.stop();

          logger.info("Tagging asset...");
          await contentAssetsApi.addContentAssetTag(
            assetId,
            "video.thumbs",
            "system",
          );

          if (fs.existsSync(spriteFile)) {
            logger.warn("Found existing sprites file, cleaning up...");
            fs.rmSync(spriteFile);
          }

          if (fs.existsSync(thumbsFile)) {
            logger.warn("Found existing thumbs VTT file, cleaning up...");
            fs.rmSync(thumbsFile);
          }

          const vtt: string[] = [];
          vtt.push("WEBVTT\n");

          const thumbnailCount = Math.ceil(duration / DEFAULT_THUMB_INTERVAL);
          const rows = Math.ceil(Math.sqrt(thumbnailCount));
          const cols = Math.ceil(thumbnailCount / rows);
          logger.debug(`Grid: ${cols} x ${rows}`);

          const sprites: OverlayOptions[] = [];

          fs.readdirSync(`${tmpDir}/screens/`)
            .filter((file) => {
              return path.extname(file).toLowerCase() === ".png";
            })
            .forEach((file, index) => {
              const row = Math.floor(index / cols);
              const col = index % cols;
              const startMs = index * DEFAULT_THUMB_INTERVAL * 1000;
              const endMs = (index + 1) * DEFAULT_THUMB_INTERVAL * 1000;

              const x = col * thumbWidth;
              const y = row * thumbHeight;

              logger.debug(
                `Adding sprite: ${file} [x=${x}, y=${y}, w=${thumbWidth}, h=${thumbHeight}]`,
              );

              sprites.push({
                input: `${tmpDir}/screens/${file}`,
                top: y,
                left: x,
              });

              vtt.push(`Img ${index + 1}`);
              vtt.push(`${ts(startMs)} --> ${ts(endMs)}`);
              vtt.push(
                `sprite.jpg#xywh=${col * thumbWidth},${
                  row * thumbHeight
                },${thumbWidth},${thumbHeight}`,
              );
              vtt.push("");
            });

          await sharp({
            create: {
              width: cols * thumbWidth,
              height: rows * thumbHeight,
              channels: 3,
              background: { r: 255, g: 255, b: 255 },
            },
          })
            .composite(sprites)
            .toFile(`${tmpDir}/sprite.jpg`);

          fs.writeFileSync(
            `${tmpDir}/thumbs.vtt`,
            Buffer.from(vtt.join("\n"), "utf-8"),
          );

          logger.info("Copying sprite to asset destination");
          fs.cpSync(`${tmpDir}/sprite.jpg`, spriteFile);

          logger.info("Copying thumbs VTT to asset destination");
          fs.cpSync(`${tmpDir}/thumbs.vtt`, thumbsFile);

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
