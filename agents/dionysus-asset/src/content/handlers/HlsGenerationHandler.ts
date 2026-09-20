import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import * as cliProgress from "cli-progress";
import * as ffmpegOnProgress from "ffmpeg-on-progress";
import Ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import { ContentApi } from "@ncfritz/olympus-client";
import { contentConfig } from "../../config/configuration";
import type { ContentConfigType } from "../../config/configuration";
import {
  CONTENT_SUBSCRIPTIONS,
  type ContentAssetJobMessage,
} from "../../messaging";

/** (Re)generates a content asset's HLS playlist and segments. */
@Injectable()
export class HlsGenerationHandler {
  private readonly logger = new Logger(HlsGenerationHandler.name);

  constructor(
    @Inject(contentConfig.KEY) private readonly content: ContentConfigType,
    private readonly contentApi: ContentApi,
  ) {}

  @RabbitSubscribe(CONTENT_SUBSCRIPTIONS.hls)
  public async handle(msg: ContentAssetJobMessage): Promise<void> {
    this.logger.log(JSON.stringify(msg));

    const assetId = msg.assetId;
    const assetsDir = this.content.assetsDir;
    const assetFile = `${assetsDir}/${assetId}/asset.mp4`;
    const playlistFile = `${assetsDir}/${assetId}/playlist.m3u8`;
    const metadataFile = `${assetsDir}/${assetId}/metadata.json`;
    const segmentsDir = `${assetsDir}/${assetId}/segments`;
    const tmpDir = `${this.content.tempDir}/${assetId}-hls`;

    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }

    this.logger.log("Starting Job - Details...");
    this.logger.log(`\tassetId: ${assetId}`);
    this.logger.log(`\tassetsDir: ${assetsDir}`);
    this.logger.log(`\tassetFile: ${assetFile}`);
    this.logger.log(`\tplaylistFile: ${playlistFile}`);
    this.logger.log(`\tmetadataFile: ${metadataFile}`);
    this.logger.log(`\tsegmentsDir: ${segmentsDir}`);
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
      fs.mkdirSync(`${tmpDir}/segments`);

      this.logger.log("Loading asset metadata...");
      const md = JSON.parse(fs.readFileSync(metadataFile).toString("utf-8"));
      const duration = md.format.duration;
      this.logger.log(`Asset duration: ${duration}`);

      await new Promise<void>((resolve, reject) => {
        this.logger.log("\nTranscode content...");

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
        command.on("error", (err, _stdout, _stderr) => {
          this.logger.error("Error encountered!", err);

          progress.stop();
          reject(err);
        });
        command.on("start", (commandLine: string) => {
          this.logger.debug(`Spawned Ffmpeg with command: ${commandLine}`);
        });
        command.on("end", async () => {
          progress.stop();

          this.logger.log("Tagging asset");
          await this.contentApi.addContentAssetTagToAsset(assetId, {
            name: "video.hls",
            type: "system",
          });

          if (fs.existsSync(segmentsDir)) {
            this.logger.warn(
              "Found existing segments directory, cleaning up...",
            );
            fs.rmSync(segmentsDir, { recursive: true });
          }

          if (fs.existsSync(playlistFile)) {
            this.logger.warn("Found existing playlist file, cleaning up...");
            fs.rmSync(playlistFile);
          }

          fs.mkdirSync(segmentsDir);

          this.logger.log("Copying segments to asset destination");
          fs.cpSync(`${tmpDir}/segments`, segmentsDir, { recursive: true });

          this.logger.log("Copying playlist to asset destination");
          fs.cpSync(`${tmpDir}/playlist.m3u8`, playlistFile);

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
