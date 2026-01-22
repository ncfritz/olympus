import {
  ContentTagType,
  ContentIngestionWorkflow,
  ContentIngestionWorkflowStep,
} from "@ncfritz/olympus-sdk/dionysus";
import * as cliProgress from "cli-progress";
import { createHash } from "crypto";
import Ffmpeg, { FfprobeData } from "fluent-ffmpeg";
import fs, { PathLike } from "fs";
import moment from "moment/moment";
import path from "path";
import sharp, { OverlayOptions } from "sharp";
import contentAssetsApi from "../api/contentAssets";
import { DuplicateError } from "../error/duplicateError";
import { IngestError } from "../error/ingestError";
import sftp from "ssh2-sftp-client";
import progress_stream from "progress-stream";
import { ts } from "../util/format";
import { logger } from "../util/logger";
import { createStep, updateStepProgress, updateStepStatus } from "./reporter";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegOnProgress = require("ffmpeg-on-progress");

export interface AssetMetadata {
  id: string;
  name: string;
  created_date: string;
  inputSha256?: string;
  outputSha256?: string;
  originalSize?: number;
  duration?: number;
  width?: number;
  height?: number;
  assetSize?: number;
}

export type MODE = "local" | "remote";
export type PendingTag = {
  name: string;
  type: ContentTagType;
};

export type AssetWorkflowProps = {
  id: string;
  input: PathLike;
  workDir: PathLike;
  mode: MODE;
  originalFilename?: string;
  ingestWorkflow: ContentIngestionWorkflow;
};

export class AssetWorkflow {
  private readonly DEFAULT_THUMB_INTERVAL = 5;
  private readonly DEFAULT_THUMB_WIDTH = 200;

  private readonly input: PathLike;
  private readonly workDir: PathLike;
  private readonly assetLocation;
  private readonly mode: MODE;
  private readonly metadata: AssetMetadata;
  private readonly ingestWorkflow: ContentIngestionWorkflow;

  private screenshotTimestamps: number[];
  private isNewAsset = false;
  private tags: PendingTag[] = [];

  constructor(props: AssetWorkflowProps) {
    console.log(props);
    this.input = props.input;
    this.workDir = props.workDir;
    this.mode = props.mode;
    this.ingestWorkflow = props.ingestWorkflow;

    let assetOriginalName = path.basename(props.input.toString());

    if (props.originalFilename) {
      assetOriginalName = props.originalFilename;
    }

    if (assetOriginalName.indexOf(".") > 0) {
      assetOriginalName = assetOriginalName.substring(
        0,
        assetOriginalName.lastIndexOf("."),
      );
    }

    this.metadata = {
      id: props.id,
      created_date: moment.utc().toISOString(),
      name: assetOriginalName,
    };

    this.assetLocation = `${props.workDir}/asset.mp4`;
  }

  async start() {
    this.isNewAsset = true;

    try {
      await this.calculateInputSha();
      await this.extractOriginalMetadata();
      await this.transcode();
      await this.extractNewMetadata();
      await this.generateThumbnails();
      await this.generateScreenshots();
      await this.generateTimelapseVideo();
      await this.generateSampleVideo();
      await this.generateVideoThumbnails();
      await this.generateHls();
      await this.finalize();
    } finally {
      await this.cleanup();
    }
  }

  async calculateInputSha(): Promise<void> {
    const step = await createStep(
      this.ingestWorkflow.id,
      "calculate_input_sha",
    );

    console.log("Generating SHA-256 of input...");
    const readableStream = fs.createReadStream(this.input);
    const hash = createHash("sha256");
    const stat = fs.statSync(this.input);

    await new Promise<void>((resolve, reject) => {
      readableStream.on("data", (chunk) => {
        hash.update(chunk);
      });
      readableStream.on("end", async () => {
        try {
          const digest = hash.digest("hex");

          console.log(`Input SHA: ${digest}`);

          this.metadata.inputSha256 = digest;
          this.metadata.originalSize = stat.size;

          console.log(`Duplicate check... ${this.metadata.inputSha256}`);
          const duplicates = await contentAssetsApi.checkDuplicates(digest);

          console.log(duplicates);

          if (duplicates && duplicates.length > 0) {
            console.log("Duplicate found!");

            fs.rmSync(this.workDir, { recursive: true });
            fs.renameSync(
              this.input,
              `${process.env.ASSETS_DIR}/duplicate/${path.basename(
                this.input.toString(),
              )}`,
            );

            reject(
              new DuplicateError(`Duplicate asset found with SHA ${digest}`),
            );
          }
        } finally {
          await updateStepStatus(this.ingestWorkflow.id, step.id, "success");
        }

        resolve();
      });
    });
  }

  async calculateOutputSha(): Promise<void> {
    const step = await createStep(
      this.ingestWorkflow.id,
      "calculate_output_sha",
    );

    console.log("Generating SHA-256 of asset...");
    const readableStream = fs.createReadStream(this.assetLocation);
    const hash = createHash("sha256");

    await new Promise<void>((resolve) => {
      readableStream.on("data", (chunk) => {
        hash.update(chunk);
      });
      readableStream.on("end", async () => {
        const digest = hash.digest("hex");
        this.metadata.outputSha256 = digest;

        console.log(`Output SHA: ${digest}`);

        await updateStepStatus(this.ingestWorkflow.id, step.id, "success");

        resolve();
      });
    });
  }

  async extractOriginalMetadata(): Promise<void> {
    const step = await createStep(
      this.ingestWorkflow.id,
      "extract_original_metadata",
    );

    console.log("\nExtract original metadata...");

    await new Promise<void>((resolve, reject) => {
      Ffmpeg.ffprobe(this.input.toString(), async (err, data) => {
        if (err) {
          await updateStepStatus(this.ingestWorkflow.id, step.id, "failed");
          reject(new IngestError("FFProbe failed with error: ", err));
        } else if (!data) {
          await updateStepStatus(this.ingestWorkflow.id, step.id, "failed");
          reject(new IngestError("FFProbe did not return any data"));
        } else {
          console.log(`Writing ${this.workDir}/original_metadata.json`);
          fs.writeFileSync(
            `${this.workDir}/original_metadata.json`,
            JSON.stringify(data, null, 2),
          );
          this.metadata.duration = Math.trunc(
            (data.format.duration || 0) * 1000,
          );

          for (let i = 0; i < data.streams.length; i++) {
            if (data.streams[i].codec_type === "video") {
              this.metadata.width = data.streams[i].width!;
              this.metadata.height = data.streams[i].height!;

              break;
            }
          }

          await updateStepStatus(this.ingestWorkflow.id, step.id, "success");

          resolve();
        }
      });
    });
  }

  async extractNewMetadata() {
    const step = await createStep(
      this.ingestWorkflow.id,
      "extract_original_metadata",
    );

    console.log("\nExtract new metadata....");

    await new Promise<void>((resolve, reject) => {
      const command = Ffmpeg(this.assetLocation.toString());
      command.ffprobe(async (err, data) => {
        if (err) {
          await updateStepStatus(this.ingestWorkflow.id, step.id, "failed");
          reject(new IngestError("FFProbe failed with error: ", err));
        } else if (!data) {
          await updateStepStatus(this.ingestWorkflow.id, step.id, "failed");
          reject(new IngestError("FFProbe did not return any data"));
        } else {
          console.log("Writing metadata");
          fs.writeFileSync(
            `${this.workDir}/metadata.json`,
            JSON.stringify(data, null, 2),
          );

          console.log("Loading details from metadata");
          await this.loadTimestampsFromMetadata(data);

          await updateStepStatus(this.ingestWorkflow.id, step.id, "success");

          resolve();
        }
      });
    });
  }

  async loadTimestampsFromMetadata(metadata: FfprobeData) {
    const duration = metadata.format.duration!;
    const step = duration / 17;

    this.screenshotTimestamps = Array.from(
      { length: 16 },
      (_, i) => (i + 1) * step,
    );
  }

  async generateThumbnails() {
    const step = await createStep(
      this.ingestWorkflow.id,
      "generate_thumbnails",
    );

    try {
      console.log("Generating thumbnails...");

      for (const timestamp of this.screenshotTimestamps) {
        const index = this.screenshotTimestamps.indexOf(timestamp);
        await this.generateScreenshot(
          timestamp,
          index,
          300,
          "thumbnails",
          step,
        );
      }

      await updateStepStatus(this.ingestWorkflow.id, step.id, "success");
    } catch (e) {
      console.log("Thumbnail generation failed with error:", e);
      await updateStepStatus(this.ingestWorkflow.id, step.id, "failed");

      throw e;
    }
  }

  async generateScreenshots() {
    const step = await createStep(
      this.ingestWorkflow.id,
      "generate_screenshots",
    );

    try {
      console.log("Generating screenshots...");

      for (const timestamp of this.screenshotTimestamps) {
        const index = this.screenshotTimestamps.indexOf(timestamp);
        await this.generateScreenshot(
          timestamp,
          index,
          640,
          "screenshots",
          step,
        );
      }

      await updateStepStatus(this.ingestWorkflow.id, step.id, "success");
    } catch (e) {
      console.log("Thumbnail generation failed with error:", e);
      await updateStepStatus(this.ingestWorkflow.id, step.id, "failed");

      throw e;
    }
  }

  generateScreenshot(
    timestamp: number,
    index: number,
    size: number,
    destination: string,
    step: ContentIngestionWorkflowStep,
  ) {
    return new Promise<void>((resolve, reject) => {
      const screenshotDestination = `${this.workDir}/${destination}`;

      if (!fs.existsSync(screenshotDestination)) {
        fs.mkdirSync(screenshotDestination);
      }

      const command = Ffmpeg(this.assetLocation);
      command.on("end", async () => {
        resolve();
      });
      command.on("error", async (err) => {
        console.log("An error occurred: " + err.message);
        fs.renameSync(
          this.input,
          `${process.env.ASSETS_DIR}/failed/${path.basename(
            this.input.toString(),
          )}`,
        );

        await updateStepStatus(this.ingestWorkflow.id, step.id, "failed");
        reject(new IngestError("Unable to transcode asset:", err));
      });
      command.screenshot({
        timestamps: [timestamp],
        size: `?x${size}`,
        filename: `${index + 1}.png`,
        folder: screenshotDestination,
      });
    });
  }

  async transcode(): Promise<void> {
    const step = await createStep(this.ingestWorkflow.id, "transcode");
    console.log("\nTranscode content...");

    await new Promise<void>((resolve, reject) => {
      const progress = new cliProgress.SingleBar({}, cliProgress.Presets.rect);
      progress.start(100, 0);

      const command = Ffmpeg(this.input.toString());
      command.videoCodec("libx264");
      command.audioCodec("libmp3lame");
      command.on("error", async (err) => {
        console.log("An error occurred: " + err.message);
        fs.renameSync(
          this.input,
          `${process.env.ASSETS_DIR}/failed/${path.basename(
            this.input.toString(),
          )}`,
        );

        await updateStepStatus(this.ingestWorkflow.id, step.id, "failed");
        reject(new IngestError("Unable to transcode asset:", err));
      });
      command.on("end", async () => {
        progress.stop();
        await this.calculateOutputSha();

        const newStat = fs.statSync(this.assetLocation);
        this.metadata.assetSize = newStat.size;

        await updateStepStatus(this.ingestWorkflow.id, step.id, "success");
        resolve();
      });
      command.on(
        "progress",
        ffmpegOnProgress(async (p: number) => {
          const progressPercent = Math.trunc(p * 100);
          progress.update(progressPercent);

          await updateStepProgress(
            this.ingestWorkflow.id,
            step.id,
            progressPercent,
          );
        }, this.metadata.duration),
      );
      command.saveToFile(this.assetLocation);
    });
  }

  async generateTimelapseVideo() {
    const step = await createStep(
      this.ingestWorkflow.id,
      "generate_time_lapse",
    );

    console.log("\nGenerate timelapse video...");

    await new Promise<void>((resolve, reject) => {
      const seconds = this.metadata.duration! / 1000;
      const ratio = seconds > 15 ? 15 / seconds : 1;

      const progress = new cliProgress.SingleBar({}, cliProgress.Presets.rect);
      progress.start(100, 0);

      const command = Ffmpeg(this.assetLocation);
      command.videoCodec("libx264");
      command.noAudio();
      command.size("?x200");

      if (ratio < 1) {
        command.videoFilters([
          {
            filter: "setpts",
            options: `${ratio}*PTS`,
          },
        ]);
      }

      command.on("error", async (err) => {
        console.log("An error occurred: " + err.message);
        fs.renameSync(
          this.input,
          `${process.env.ASSETS_DIR}/failed/${path.basename(
            this.input.toString(),
          )}`,
        );

        await updateStepStatus(this.ingestWorkflow.id, step.id, "failed");
        reject(new IngestError("Unable to transcode asset:", err));
      });
      command.on("end", async () => {
        progress.stop();
        await updateStepStatus(this.ingestWorkflow.id, step.id, "success");
        resolve();
      });
      command.on(
        "progress",
        ffmpegOnProgress(async (p: number) => {
          const progressPercent = Math.trunc(p * 100);
          progress.update(progressPercent);

          await updateStepProgress(
            this.ingestWorkflow.id,
            step.id,
            progressPercent,
          );
        }, 15),
      );
      command.saveToFile(`${this.workDir}/timelapse.mp4`);
    });
  }

  async generateSampleVideo() {
    const step = await createStep(
      this.ingestWorkflow.id,
      "generate_sample_video",
    );

    console.log("\nGenerate sample video...");

    await new Promise<void>((resolve, reject) => {
      const seconds = this.metadata.duration! / 1000;
      const start = seconds <= 20 ? 0 : seconds / 2 - 7.5;

      const progress = new cliProgress.SingleBar({}, cliProgress.Presets.rect);
      progress.start(100, 0);

      const command = Ffmpeg(this.assetLocation);
      command.videoCodec("libx264");
      command.noAudio();
      command.size("?x200");
      command.seekInput(start);
      command.setDuration(15);

      command.on("error", async (err) => {
        console.log("An error occurred: " + err.message);
        fs.renameSync(
          this.input,
          `${process.env.ASSETS_DIR}/${path.basename(this.input.toString())}`,
        );

        await updateStepStatus(this.ingestWorkflow.id, step.id, "failed");
        reject(new IngestError("Unable to transcode asset:", err));
      });
      command.on("end", async () => {
        progress.stop();
        await updateStepStatus(this.ingestWorkflow.id, step.id, "success");
        resolve();
      });
      command.on(
        "progress",
        ffmpegOnProgress(async (p: number) => {
          const progressPercent = Math.trunc(p * 100);
          progress.update(progressPercent);

          await updateStepProgress(
            this.ingestWorkflow.id,
            step.id,
            progressPercent,
          );
        }, 15),
      );
      command.saveToFile(`${this.workDir}/sample.mp4`);
    });
  }

  async generateVideoThumbnails(): Promise<void> {
    const step = await createStep(
      this.ingestWorkflow.id,
      "generate_video_thumbnails",
    );

    console.log("\nGenerate thumbnails...");

    await new Promise<void>((resolve, reject) => {
      const spriteFile = `${this.workDir}/sprite.jpg`;
      const thumbsFile = `${this.workDir}/thumbs.vtt`;
      const screensDir = `${this.workDir}/screens/`;
      const ratio = this.metadata.width! / this.metadata.height!;
      const thumbWidth = this.DEFAULT_THUMB_WIDTH;
      const thumbHeight = Math.ceil((1 / ratio) * this.DEFAULT_THUMB_WIDTH);
      const duration = this.metadata.duration! / 1000;

      fs.mkdirSync(screensDir);

      const progress = new cliProgress.SingleBar({}, cliProgress.Presets.rect);
      progress.start(100, 0);

      const command = Ffmpeg(this.assetLocation);
      command.videoFilters([
        `fps=${1 / this.DEFAULT_THUMB_INTERVAL}`,
        `scale='min(${this.DEFAULT_THUMB_WIDTH}\\, iw):-1'`,
      ]);
      command.output(`${this.workDir}/screens/thumb%04d.png`);
      command.on("error", async (err, stdout, stderr) => {
        progress.stop();

        logger.error("Unable to generate thumbnails:", err);
        logger.debug("stdout:", stdout);
        logger.debug("stderr:", stderr);

        await updateStepStatus(this.ingestWorkflow.id, step.id, "failed");
        reject(new IngestError("Unable to generate thumbnail:", err));
      });
      command.on("start", function (commandLine: string) {
        console.log(`Spawned Ffmpeg with command: ${commandLine}`);
      });
      command.on("end", async () => {
        progress.stop();

        try {
          console.log("Tagging asset");
          this.tags.push({
            name: "video.thumbs",
            type: "system",
          });

          if (fs.existsSync(spriteFile)) {
            console.warn("Found existing sprites file, cleaning up...");
            fs.rmSync(spriteFile);
          }

          if (fs.existsSync(thumbsFile)) {
            console.warn("Found existing thumbs VTT file, cleaning up...");
            fs.rmSync(thumbsFile);
          }

          const vtt: string[] = [];
          vtt.push("WEBVTT\n");

          const thumbnailCount = Math.ceil(
            duration / this.DEFAULT_THUMB_INTERVAL,
          );
          console.log(`Thumbnail count: ${thumbnailCount}`);

          const rows = Math.ceil(Math.sqrt(thumbnailCount));
          const cols = Math.ceil(thumbnailCount / rows);
          console.log(`Grid: ${cols} x ${rows}`);

          const sprites: OverlayOptions[] = [];

          fs.readdirSync(screensDir)
            .filter((file) => {
              return path.extname(file).toLowerCase() === ".png";
            })
            .forEach((file, index) => {
              const row = Math.floor(index / cols);
              const col = index % cols;
              const startMs = index * this.DEFAULT_THUMB_INTERVAL * 1000;
              const endMs = (index + 1) * this.DEFAULT_THUMB_INTERVAL * 1000;

              const x = col * thumbWidth;
              const y = row * thumbHeight;

              console.log(
                `Adding sprite: ${file} [x=${x}, y=${y}, w=${thumbWidth}, h=${thumbHeight}]`,
              );

              sprites.push({
                input: `${screensDir}/${file}`,
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
            .toFile(`${this.workDir}/sprite.jpg`);

          fs.writeFileSync(
            `${this.workDir}/thumbs.vtt`,
            Buffer.from(vtt.join("\n"), "utf-8"),
          );

          console.log("Removing 'screens' directory");
          fs.rmdirSync(screensDir, { recursive: true });

          await updateStepStatus(this.ingestWorkflow.id, step.id, "success");

          resolve();
        } catch (e) {
          await updateStepStatus(this.ingestWorkflow.id, step.id, "failed");
          reject(new IngestError("Unable to create sprites/VTT", e));
        }
      });
      command.on(
        "progress",
        ffmpegOnProgress(async (p: number, e: any) => {
          const progressPercent = Math.trunc(p * 100);
          progress.update(progressPercent);

          await updateStepProgress(
            this.ingestWorkflow.id,
            step.id,
            progressPercent,
          );
        }, this.metadata.duration!),
      );
      command.run();
    });
  }

  async generateHls(): Promise<void> {
    const step = await createStep(this.ingestWorkflow.id, "generate_hls");

    console.log("\nGenerate HLS segments...");

    await new Promise<void>((resolve, reject) => {
      const playlistFile = `${this.workDir}/playlist.m3u8`;
      const segmentsDir = `${this.workDir}/segments`;

      if (fs.existsSync(segmentsDir)) {
        console.warn("Found existing segments directory, cleaning up...");
        fs.rmSync(segmentsDir, { recursive: true });
      }

      if (fs.existsSync(playlistFile)) {
        console.warn("Found existing playlist file, cleaning up...");
        fs.rmSync(playlistFile);
      }

      fs.mkdirSync(segmentsDir);

      const progress = new cliProgress.SingleBar({}, cliProgress.Presets.rect);
      progress.start(100, 0);

      const command = Ffmpeg(this.assetLocation);
      command.videoCodec("copy");
      command.audioCodec("copy");
      command.addOptions([
        "-start_number 0",
        "-hls_time 4",
        "-hls_list_size 0",
        "-f hls",
        `-hls_segment_filename ${segmentsDir}/segment%03d.ts`,
        "-hls_base_url segments/",
      ]);
      command.output(playlistFile);
      command.on("error", async (err, stdout, stderr) => {
        progress.stop();

        logger.error("Unable to generate HLS segments:", err);
        logger.debug("stdout:", stdout);
        logger.debug("stderr:", stderr);

        await updateStepStatus(this.ingestWorkflow.id, step.id, "failed");
        reject(new IngestError("Unable to generate thumbnail:", err));
      });
      command.on("start", function (commandLine: string) {
        console.log(`Spawned Ffmpeg with command: ${commandLine}`);
      });
      command.on("end", async () => {
        progress.stop();

        try {
          this.tags.push({
            name: "video.hls",
            type: "system",
          });

          await updateStepStatus(this.ingestWorkflow.id, step.id, "success");

          resolve();
        } catch (e) {
          await updateStepStatus(this.ingestWorkflow.id, step.id, "failed");
          reject(new IngestError("Unable to create sprites/VTT", e));
        }
      });
      command.on(
        "progress",
        ffmpegOnProgress(async (p: number, e: any) => {
          const progressPercent = Math.trunc(p * 100);
          progress.update(progressPercent);

          await updateStepProgress(
            this.ingestWorkflow.id,
            step.id,
            progressPercent,
          );
        }, this.metadata.duration),
      );
      command.run();
    });
  }

  async upload(): Promise<void> {
    const step = await createStep(this.ingestWorkflow.id, "upload");

    try {
      console.log("\nAggregating files...");
      const files = this.walk(this.workDir.toString());

      console.log("Connecting SSH...");
      const client = new sftp();
      await client.connect({
        host: "nfs01.sea.ncfritz.net",
        port: 22,
        username: process.env.SSH_USERNAME!,
        password: process.env.SSH_PASSWORD!,
      });

      for (const file of files) {
        const stat = fs.statSync(file);
        const truncatedPath = file.substring(
          this.workDir.toString().length,
          file.length,
        );

        const progress = new cliProgress.SingleBar(
          { format: " {bar} | {filename} | {percent}% | {value}/{total}" },
          cliProgress.Presets.rect,
        );
        const pStream = progress_stream({
          length: stat.size,
          time: 500,
        });
        pStream.on(
          "progress",
          (p: { transferred: number; percentage: number }) => {
            progress.update(p.transferred, {
              percent: p.percentage.toFixed(2),
            });
          },
        );

        progress.start(stat.size, 0, { filename: truncatedPath, percent: 0 });

        const remote = `/Content/assets/${this.metadata.id}/${truncatedPath}`;
        const remoteDir = remote.substring(0, remote.lastIndexOf("/"));
        const stream = fs.createReadStream(file).pipe(pStream);

        await client.mkdir(remoteDir, true);
        await client.put(stream, remote);
        progress.stop();
      }

      await client.end();

      await updateStepStatus(this.ingestWorkflow.id, step.id, "success");
    } catch (e) {
      console.log("Asset upload failed:", e);
      await updateStepStatus(this.ingestWorkflow.id, step.id, "failed");

      throw new IngestError("Unable to upload assets:", e);
    }
  }

  async copy(): Promise<void> {
    const step = await createStep(this.ingestWorkflow.id, "copy");

    console.log("\nAggregating files...");
    const files = this.walk(this.workDir.toString());

    for (const file of files) {
      const truncatedPath = file.substring(
        this.workDir.toString().length,
        file.length,
      );

      const destination = `/Content/assets/${this.metadata.id}/${truncatedPath}`;
      const remoteDir = destination.substring(0, destination.lastIndexOf("/"));

      fs.mkdirSync(remoteDir, { recursive: true });
      fs.copyFileSync(file, destination);
    }

    await updateStepStatus(this.ingestWorkflow.id, step.id, "success");
  }

  async finalize() {
    fs.writeFileSync(
      `${this.workDir}/record.json`,
      JSON.stringify(this.metadata, null, 2),
    );

    if (this.mode === "local") {
      await this.upload();
    } else {
      await this.copy();
    }

    if (this.isNewAsset) {
      await contentAssetsApi.createContentAsset(this.metadata);
    }

    for (const pendingTag of this.tags) {
      await contentAssetsApi.addContentAssetTag(
        this.metadata.id,
        pendingTag.name,
        pendingTag.type,
      );
    }
  }

  async cleanup() {
    const step = await createStep(this.ingestWorkflow.id, "cleanup");

    try {
      console.log("\nCleanup...");
      fs.rmSync(this.workDir, { recursive: true });
      fs.renameSync(
        this.input,
        `${process.env.ASSETS_DIR}/processed/${path.basename(
          this.input.toString(),
        )}`,
      );

      await updateStepStatus(this.ingestWorkflow.id, step.id, "success");
    } catch (e) {
      logger.error("Cleanup failed:", e);
      await updateStepStatus(this.ingestWorkflow.id, step.id, "failed");
    }
  }

  private walk(d: string, f: string[] = []) {
    const files = fs.readdirSync(d);

    for (const file of files) {
      const filepath = path.join(d, file);
      const stat = fs.statSync(filepath);

      if (stat.isDirectory()) {
        f = this.walk(filepath, f);
      } else {
        f.push(`${d}/${file}`);
      }
    }

    return f;
  }
}
