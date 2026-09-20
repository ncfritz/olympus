import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import * as cliProgress from "cli-progress";
import * as ffmpegOnProgress from "ffmpeg-on-progress";
import Ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import * as path from "path";
import sharp, { OverlayOptions } from "sharp";
import { ContentApi } from "@ncfritz/olympus-client";
import { contentConfig } from "../../config/configuration";
import type { ContentConfigType } from "../../config/configuration";
import {
  CONTENT_SUBSCRIPTIONS,
  type ContentAssetJobMessage,
} from "../../messaging";
import { ts } from "../services/format";

const DEFAULT_THUMB_INTERVAL = 5;
const DEFAULT_THUMB_WIDTH = 200;

/** (Re)generates a content asset's thumbnail sprite and its WebVTT index. */
@Injectable()
export class ThumbnailGenerationHandler {
  private readonly logger = new Logger(ThumbnailGenerationHandler.name);

  constructor(
    @Inject(contentConfig.KEY) private readonly content: ContentConfigType,
    private readonly contentApi: ContentApi,
  ) {}

  @RabbitSubscribe(CONTENT_SUBSCRIPTIONS.thumbnail)
  public async handle(msg: ContentAssetJobMessage): Promise<void> {
    this.logger.log(JSON.stringify(msg));

    const assetId = msg.assetId;
    const assetsDir = this.content.assetsDir;
    const assetFile = `${assetsDir}/${assetId}/asset.mp4`;
    const metadataFile = `${assetsDir}/${assetId}/metadata.json`;
    const spriteFile = `${assetsDir}/${assetId}/sprite.jpg`;
    const thumbsFile = `${assetsDir}/${assetId}/thumbs.vtt`;
    const tmpDir = `${assetsDir}/tmp`;

    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }

    this.logger.log("Starting Job - Details...");
    this.logger.log(`\tassetId: ${assetId}`);
    this.logger.log(`\tassetsDir: ${assetsDir}`);
    this.logger.log(`\tassetFile: ${assetFile}`);
    this.logger.log(`\tmetadataFile: ${metadataFile}`);
    this.logger.log(`\tspriteFile: ${spriteFile}`);
    this.logger.log(`\tthumbsFile: ${thumbsFile}`);
    this.logger.log(`\ttmpDir: ${tmpDir}`);

    if (!fs.existsSync(assetFile) || !fs.existsSync(metadataFile)) {
      this.logger.error("Missing asset file or asset metadata... aborting!");
      return;
    }

    try {
      this.logger.log(`Checking for tmp existence: ${tmpDir}`);

      if (fs.existsSync(tmpDir)) {
        this.logger.log("Removing existing tmp dir");
        fs.rmSync(tmpDir, { recursive: true });
      }

      this.logger.log(`Creating tmp dir: ${tmpDir}`);
      fs.mkdirSync(tmpDir);
      fs.mkdirSync(`${tmpDir}/screens`);

      this.logger.log("Loading asset metadata...");
      const md = JSON.parse(fs.readFileSync(metadataFile).toString("utf-8"));
      const duration = md.format.duration;
      const width = md.streams[0].width;
      const height = md.streams[0].height;
      const ratio = width / height;
      const thumbWidth = DEFAULT_THUMB_WIDTH;
      const thumbHeight = Math.ceil((1 / ratio) * DEFAULT_THUMB_WIDTH);

      this.logger.log("Asset details:");
      this.logger.log(`\tDuration: ${duration}s`);
      this.logger.log(`\tWidth: ${width}px`);
      this.logger.log(`\tHeight: ${height}px`);
      this.logger.log(`\tRatio: ${ratio}`);
      this.logger.log(`\tThumbsize: ${thumbWidth} x ${thumbHeight}`);

      await new Promise<void>((resolve, reject) => {
        this.logger.log("\nTranscode content...");

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
        command.on("error", (err, stdout, stderr) => {
          this.logger.error("Error encountered!");
          this.logger.debug(stdout);
          this.logger.debug(stderr);

          progress.stop();
          reject(err);
        });
        command.on("start", (commandLine: string) => {
          this.logger.log(`Spawned Ffmpeg with command: ${commandLine}`);
        });
        command.on("end", async () => {
          progress.stop();

          this.logger.log("Tagging asset...");
          await this.contentApi.addContentAssetTagToAsset(assetId, {
            name: "video.thumbs",
            type: "system",
          });

          if (fs.existsSync(spriteFile)) {
            this.logger.warn("Found existing sprites file, cleaning up...");
            fs.rmSync(spriteFile);
          }

          if (fs.existsSync(thumbsFile)) {
            this.logger.warn("Found existing thumbs VTT file, cleaning up...");
            fs.rmSync(thumbsFile);
          }

          const vtt: string[] = [];
          vtt.push("WEBVTT\n");

          const thumbnailCount = Math.ceil(duration / DEFAULT_THUMB_INTERVAL);
          const rows = Math.ceil(Math.sqrt(thumbnailCount));
          const cols = Math.ceil(thumbnailCount / rows);
          this.logger.debug(`Grid: ${cols} x ${rows}`);

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

              this.logger.debug(
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

          this.logger.log("Copying sprite to asset destination");
          fs.cpSync(`${tmpDir}/sprite.jpg`, spriteFile);

          this.logger.log("Copying thumbs VTT to asset destination");
          fs.cpSync(`${tmpDir}/thumbs.vtt`, thumbsFile);

          resolve();
        });
        command.on(
          "progress",
          ffmpegOnProgress((p: number) => {
            progress.update(Math.trunc(p * 100));
          }, duration),
        );
        command.run();
      });
    } finally {
      this.logger.log("Cleaning up...");
      fs.rmSync(tmpDir, { recursive: true });
    }
  }
}
