import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { ContentTagType } from "@ncfritz/olympus-model";
import { Injectable } from "@nestjs/common";
import { ConsumeMessage } from "amqplib";
import * as cliProgress from "cli-progress";
import Ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import contentAssetsApi from "../api/contentAssets";
import {
  ASSETS_JOB_PREFIX,
  JOB_TYPE_PREFIX,
  TRIGGER_SUFFIX,
} from "../util/constants";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegOnProgress = require("ffmpeg-on-progress");

@Injectable()
export class HlsGenerationAssetHandler {
  @RabbitSubscribe({
    exchange: `${ASSETS_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${ASSETS_JOB_PREFIX}.hls.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.hls`,
  })
  public async handle(msg: any, amqlMsg: ConsumeMessage) {
    console.log(msg);

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

    console.log("Starting Job - Details...");
    console.log(`\tassetId: ${assetId}`);
    console.log(`\tassetsDir: ${assetsDir}`);
    console.log(`\tassetFile: ${assetFile}`);
    console.log(`\tplaylistFile: ${playlistFile}`);
    console.log(`\tmetadataFile: ${metadataFile}`);
    console.log(`\tsegmentsDir: ${segmentsDir}`);
    console.log(`\ttmpDir: ${tmpDir}`);

    if (!fs.existsSync(assetFile) || !fs.existsSync(metadataFile)) {
      console.error("Missing asset file or asset metadata... aborting!");
      return;
    }

    try {
      console.log(`Checking for tmp existence: ${tmpDir}`);
      if (fs.existsSync(tmpDir)) {
        console.log("Removing existing tmp dir");
        fs.rmSync(tmpDir, { recursive: true });
      }

      console.log(`Creating tmp dir: ${tmpDir}`);
      fs.mkdirSync(tmpDir);
      fs.mkdirSync(`${tmpDir}/segments`);

      console.log("Loading asset metadata...");
      const md = JSON.parse(fs.readFileSync(metadataFile).toString("utf-8"));
      const duration = md.format.duration;
      console.log(`Asset duration: ${duration}`);

      await new Promise<void>((resolve, reject) => {
        console.log("\nTranscode content...");

        const progress = new cliProgress.SingleBar(
          {},
          cliProgress.Presets.rect
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
          console.log("Error encountered!");
          console.log(stdout);
          console.log(stderr);

          progress.stop();
          reject(err);
        });
        command.on("start", function (commandLine: string) {
          console.log(`Spawned Ffmpeg with command: ${commandLine}`);
        });
        command.on("end", async function () {
          progress.stop();

          console.log("Tagging asset");
          await contentAssetsApi.addTag(
            assetId,
            "video.hls",
            ContentTagType.SYSTEM
          );

          if (fs.existsSync(segmentsDir)) {
            console.warn("Found existing segments directory, cleaning up...");
            fs.rmSync(segmentsDir, { recursive: true });
          }

          if (fs.existsSync(playlistFile)) {
            console.warn("Found existing playlist file, cleaning up...");
            fs.rmSync(playlistFile);
          }

          fs.mkdirSync(segmentsDir);

          console.log("Copying segments to asset destination");
          fs.cpSync(`${tmpDir}/segments`, segmentsDir, { recursive: true });

          console.log("Copying playlist to asset destination");
          fs.cpSync(`${tmpDir}/playlist.m3u8`, playlistFile);

          resolve();
        });
        command.on(
          "progress",
          ffmpegOnProgress((p: number, e: any) => {
            progress.update(Math.trunc(p * 100));
          }, duration)
        );
        command.run();
      });
    } finally {
      console.log("Cleaning up...");
      fs.rmSync(tmpDir, { recursive: true });
    }
  }
}
