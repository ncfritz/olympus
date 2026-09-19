import type {
  ContentTagType,
  ContentIngestionWorkflow,
  ContentIngestionWorkflowStep,
} from "@ncfritz/olympus-sdk/dionysus";
import * as cliProgress from "cli-progress";
import Ffmpeg, { FfprobeData } from "fluent-ffmpeg";
import fs, { PathLike } from "fs";
import moment from "moment";
import path from "path";
import sharp, { OverlayOptions } from "sharp";
import { Logger } from "@nestjs/common";
import type { ContentApi } from "../../api/ContentApi";
import type { ContentConfigType } from "../../config/configuration";
import { sha256File } from "../../tools/sha256";
import { withSftp } from "../../tools/sftp";
import { IngestError } from "../../tools/errors/IngestError";
import type { ContentReporter } from "./ContentReporter";
import { DuplicateError } from "./DuplicateError";
import progress_stream from "progress-stream";
import { ts } from "./format";
import * as ffmpegOnProgress from "ffmpeg-on-progress";

const logger = new Logger("AssetWorkflow");

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

/** What an asset workflow works with. */
export type AssetWorkflowDeps = {
  config: ContentConfigType;
  contentApi: ContentApi;
  reporter: ContentReporter;
};

export type AssetWorkflowProps = {
  id: string;
  input: PathLike;
  workDir: PathLike;
  mode: MODE;
  originalFilename?: string;
  ingestWorkflow: ContentIngestionWorkflow;
};

/**
 * Ingests one content asset: duplicate check, metadata, transcode,
 * thumbnails, screenshots, timelapse and sample videos, HLS, upload.
 */
export class AssetWorkflow {
  private readonly config: ContentConfigType;
  private readonly contentApi: ContentApi;
  private readonly reporter: ContentReporter;

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

  constructor(props: AssetWorkflowProps, deps: AssetWorkflowDeps) {
    this.config = deps.config;
    this.contentApi = deps.contentApi;
    this.reporter = deps.reporter;
    logger.debug(`Asset workflow ${props.id}: ${props.input}`);
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
    const step = await this.reporter.createStep(
      this.ingestWorkflow.id,
      "calculate_input_sha",
    );

    logger.log("Generating SHA-256 of input...");
    const stat = fs.statSync(this.input);
    const digest = await sha256File(this.input);

    try {
      logger.log(`Input SHA: ${digest}`);

      this.metadata.inputSha256 = digest;
      this.metadata.originalSize = stat.size;

      logger.log(`Duplicate check... ${this.metadata.inputSha256}`);
      const duplicates = await this.contentApi.checkDuplicates(digest);

      logger.log(JSON.stringify(duplicates));

      if (duplicates && duplicates.length > 0) {
        logger.log("Duplicate found!");

        fs.rmSync(this.workDir, { recursive: true });
        fs.renameSync(
          this.input,
          `${this.config.assetsDir}/duplicate/${path.basename(
            this.input.toString(),
          )}`,
        );

        throw new DuplicateError(`Duplicate asset found with SHA ${digest}`);
      }
    } finally {
      await this.reporter.updateStepStatus(
        this.ingestWorkflow.id,
        step.id,
        "success",
      );
    }
  }

  async calculateOutputSha(): Promise<void> {
    const step = await this.reporter.createStep(
      this.ingestWorkflow.id,
      "calculate_output_sha",
    );

    logger.log("Generating SHA-256 of asset...");
    const digest = await sha256File(this.assetLocation);
    this.metadata.outputSha256 = digest;

    logger.log(`Output SHA: ${digest}`);

    await this.reporter.updateStepStatus(
      this.ingestWorkflow.id,
      step.id,
      "success",
    );
  }

  async extractOriginalMetadata(): Promise<void> {
    const step = await this.reporter.createStep(
      this.ingestWorkflow.id,
      "extract_original_metadata",
    );

    logger.log("\nExtract original metadata...");

    await new Promise<void>((resolve, reject) => {
      Ffmpeg.ffprobe(this.input.toString(), async (err, data) => {
        if (err) {
          await this.reporter.updateStepStatus(
            this.ingestWorkflow.id,
            step.id,
            "failed",
          );
          reject(new IngestError("FFProbe failed with error: ", err));
        } else if (!data) {
          await this.reporter.updateStepStatus(
            this.ingestWorkflow.id,
            step.id,
            "failed",
          );
          reject(new IngestError("FFProbe did not return any data"));
        } else {
          logger.log(`Writing ${this.workDir}/original_metadata.json`);
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

          await this.reporter.updateStepStatus(
            this.ingestWorkflow.id,
            step.id,
            "success",
          );

          resolve();
        }
      });
    });
  }

  async extractNewMetadata() {
    const step = await this.reporter.createStep(
      this.ingestWorkflow.id,
      "extract_original_metadata",
    );

    logger.log("\nExtract new metadata....");

    await new Promise<void>((resolve, reject) => {
      const command = Ffmpeg(this.assetLocation.toString());
      command.ffprobe(async (err, data) => {
        if (err) {
          await this.reporter.updateStepStatus(
            this.ingestWorkflow.id,
            step.id,
            "failed",
          );
          reject(new IngestError("FFProbe failed with error: ", err));
        } else if (!data) {
          await this.reporter.updateStepStatus(
            this.ingestWorkflow.id,
            step.id,
            "failed",
          );
          reject(new IngestError("FFProbe did not return any data"));
        } else {
          logger.log("Writing metadata");
          fs.writeFileSync(
            `${this.workDir}/metadata.json`,
            JSON.stringify(data, null, 2),
          );

          logger.log("Loading details from metadata");
          await this.loadTimestampsFromMetadata(data);

          await this.reporter.updateStepStatus(
            this.ingestWorkflow.id,
            step.id,
            "success",
          );

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
    const step = await this.reporter.createStep(
      this.ingestWorkflow.id,
      "generate_thumbnails",
    );

    try {
      logger.log("Generating thumbnails...");

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

      await this.reporter.updateStepStatus(
        this.ingestWorkflow.id,
        step.id,
        "success",
      );
    } catch (e) {
      logger.log(
        `Thumbnail generation failed with error: ${e instanceof Error ? e.message : JSON.stringify(e)}`,
      );
      await this.reporter.updateStepStatus(
        this.ingestWorkflow.id,
        step.id,
        "failed",
      );

      throw e;
    }
  }

  async generateScreenshots() {
    const step = await this.reporter.createStep(
      this.ingestWorkflow.id,
      "generate_screenshots",
    );

    try {
      logger.log("Generating screenshots...");

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

      await this.reporter.updateStepStatus(
        this.ingestWorkflow.id,
        step.id,
        "success",
      );
    } catch (e) {
      logger.log(
        `Thumbnail generation failed with error: ${e instanceof Error ? e.message : JSON.stringify(e)}`,
      );
      await this.reporter.updateStepStatus(
        this.ingestWorkflow.id,
        step.id,
        "failed",
      );

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
        logger.log("An error occurred: " + err.message);
        fs.renameSync(
          this.input,
          `${this.config.assetsDir}/failed/${path.basename(
            this.input.toString(),
          )}`,
        );

        await this.reporter.updateStepStatus(
          this.ingestWorkflow.id,
          step.id,
          "failed",
        );
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
    const step = await this.reporter.createStep(
      this.ingestWorkflow.id,
      "transcode",
    );
    logger.log("\nTranscode content...");

    await new Promise<void>((resolve, reject) => {
      const progress = new cliProgress.SingleBar({}, cliProgress.Presets.rect);
      progress.start(100, 0);

      const command = Ffmpeg(this.input.toString());
      command.videoCodec("libx264");
      command.audioCodec("libmp3lame");
      command.on("error", async (err) => {
        logger.log("An error occurred: " + err.message);
        fs.renameSync(
          this.input,
          `${this.config.assetsDir}/failed/${path.basename(
            this.input.toString(),
          )}`,
        );

        await this.reporter.updateStepStatus(
          this.ingestWorkflow.id,
          step.id,
          "failed",
        );
        reject(new IngestError("Unable to transcode asset:", err));
      });
      command.on("end", async () => {
        progress.stop();
        await this.calculateOutputSha();

        const newStat = fs.statSync(this.assetLocation);
        this.metadata.assetSize = newStat.size;

        await this.reporter.updateStepStatus(
          this.ingestWorkflow.id,
          step.id,
          "success",
        );
        resolve();
      });
      command.on(
        "progress",
        ffmpegOnProgress(async (p: number) => {
          const progressPercent = Math.trunc(p * 100);
          progress.update(progressPercent);

          await this.reporter.updateStepProgress(
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
    const step = await this.reporter.createStep(
      this.ingestWorkflow.id,
      "generate_time_lapse",
    );

    logger.log("\nGenerate timelapse video...");

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
        logger.log("An error occurred: " + err.message);
        fs.renameSync(
          this.input,
          `${this.config.assetsDir}/failed/${path.basename(
            this.input.toString(),
          )}`,
        );

        await this.reporter.updateStepStatus(
          this.ingestWorkflow.id,
          step.id,
          "failed",
        );
        reject(new IngestError("Unable to transcode asset:", err));
      });
      command.on("end", async () => {
        progress.stop();
        await this.reporter.updateStepStatus(
          this.ingestWorkflow.id,
          step.id,
          "success",
        );
        resolve();
      });
      command.on(
        "progress",
        ffmpegOnProgress(async (p: number) => {
          const progressPercent = Math.trunc(p * 100);
          progress.update(progressPercent);

          await this.reporter.updateStepProgress(
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
    const step = await this.reporter.createStep(
      this.ingestWorkflow.id,
      "generate_sample_video",
    );

    logger.log("\nGenerate sample video...");

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
        logger.log("An error occurred: " + err.message);
        fs.renameSync(
          this.input,
          `${this.config.assetsDir}/${path.basename(this.input.toString())}`,
        );

        await this.reporter.updateStepStatus(
          this.ingestWorkflow.id,
          step.id,
          "failed",
        );
        reject(new IngestError("Unable to transcode asset:", err));
      });
      command.on("end", async () => {
        progress.stop();
        await this.reporter.updateStepStatus(
          this.ingestWorkflow.id,
          step.id,
          "success",
        );
        resolve();
      });
      command.on(
        "progress",
        ffmpegOnProgress(async (p: number) => {
          const progressPercent = Math.trunc(p * 100);
          progress.update(progressPercent);

          await this.reporter.updateStepProgress(
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
    const step = await this.reporter.createStep(
      this.ingestWorkflow.id,
      "generate_video_thumbnails",
    );

    logger.log("\nGenerate thumbnails...");

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

        await this.reporter.updateStepStatus(
          this.ingestWorkflow.id,
          step.id,
          "failed",
        );
        reject(new IngestError("Unable to generate thumbnail:", err));
      });
      command.on("start", function (commandLine: string) {
        logger.log(`Spawned Ffmpeg with command: ${commandLine}`);
      });
      command.on("end", async () => {
        progress.stop();

        try {
          logger.log("Tagging asset");
          this.tags.push({
            name: "video.thumbs",
            type: "system",
          });

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

          const thumbnailCount = Math.ceil(
            duration / this.DEFAULT_THUMB_INTERVAL,
          );
          logger.log(`Thumbnail count: ${thumbnailCount}`);

          const rows = Math.ceil(Math.sqrt(thumbnailCount));
          const cols = Math.ceil(thumbnailCount / rows);
          logger.log(`Grid: ${cols} x ${rows}`);

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

              logger.log(
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

          logger.log("Removing 'screens' directory");
          fs.rmSync(screensDir, { recursive: true, force: true });

          await this.reporter.updateStepStatus(
            this.ingestWorkflow.id,
            step.id,
            "success",
          );

          resolve();
        } catch (e) {
          await this.reporter.updateStepStatus(
            this.ingestWorkflow.id,
            step.id,
            "failed",
          );
          reject(new IngestError("Unable to create sprites/VTT", e));
        }
      });
      command.on(
        "progress",
        ffmpegOnProgress(async (p: number) => {
          const progressPercent = Math.trunc(p * 100);
          progress.update(progressPercent);

          await this.reporter.updateStepProgress(
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
    const step = await this.reporter.createStep(
      this.ingestWorkflow.id,
      "generate_hls",
    );

    logger.log("\nGenerate HLS segments...");

    await new Promise<void>((resolve, reject) => {
      const playlistFile = `${this.workDir}/playlist.m3u8`;
      const segmentsDir = `${this.workDir}/segments`;

      if (fs.existsSync(segmentsDir)) {
        logger.warn("Found existing segments directory, cleaning up...");
        fs.rmSync(segmentsDir, { recursive: true });
      }

      if (fs.existsSync(playlistFile)) {
        logger.warn("Found existing playlist file, cleaning up...");
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

        await this.reporter.updateStepStatus(
          this.ingestWorkflow.id,
          step.id,
          "failed",
        );
        reject(new IngestError("Unable to generate thumbnail:", err));
      });
      command.on("start", function (commandLine: string) {
        logger.log(`Spawned Ffmpeg with command: ${commandLine}`);
      });
      command.on("end", async () => {
        progress.stop();

        try {
          this.tags.push({
            name: "video.hls",
            type: "system",
          });

          await this.reporter.updateStepStatus(
            this.ingestWorkflow.id,
            step.id,
            "success",
          );

          resolve();
        } catch (e) {
          await this.reporter.updateStepStatus(
            this.ingestWorkflow.id,
            step.id,
            "failed",
          );
          reject(new IngestError("Unable to create sprites/VTT", e));
        }
      });
      command.on(
        "progress",
        ffmpegOnProgress(async (p: number) => {
          const progressPercent = Math.trunc(p * 100);
          progress.update(progressPercent);

          await this.reporter.updateStepProgress(
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
    const step = await this.reporter.createStep(
      this.ingestWorkflow.id,
      "upload",
    );

    try {
      logger.log("\nAggregating files...");
      const files = this.walk(this.workDir.toString());

      logger.log("Connecting SSH...");
      await withSftp(
        {
          host: this.config.sftp.host,
          port: 22,
          username: this.config.sftp.username!,
          password: this.config.sftp.password!,
        },
        async (client) => {
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

            progress.start(stat.size, 0, {
              filename: truncatedPath,
              percent: 0,
            });

            const remote = `/Content/assets/${this.metadata.id}/${truncatedPath}`;
            const remoteDir = remote.substring(0, remote.lastIndexOf("/"));
            const stream = fs.createReadStream(file).pipe(pStream);

            await client.mkdir(remoteDir, true);
            await client.put(stream, remote);
            progress.stop();
          }
        },
      );

      await this.reporter.updateStepStatus(
        this.ingestWorkflow.id,
        step.id,
        "success",
      );
    } catch (e) {
      logger.log(
        `Asset upload failed: ${e instanceof Error ? e.message : JSON.stringify(e)}`,
      );
      await this.reporter.updateStepStatus(
        this.ingestWorkflow.id,
        step.id,
        "failed",
      );

      throw new IngestError("Unable to upload assets:", e);
    }
  }

  async copy(): Promise<void> {
    const step = await this.reporter.createStep(this.ingestWorkflow.id, "copy");

    logger.log("\nAggregating files...");
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

    await this.reporter.updateStepStatus(
      this.ingestWorkflow.id,
      step.id,
      "success",
    );
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
      await this.contentApi.createContentAsset(this.metadata);
    }

    for (const pendingTag of this.tags) {
      await this.contentApi.addContentAssetTag(
        this.metadata.id,
        pendingTag.name,
        pendingTag.type,
      );
    }
  }

  async cleanup() {
    const step = await this.reporter.createStep(
      this.ingestWorkflow.id,
      "cleanup",
    );

    try {
      logger.log("\nCleanup...");
      fs.rmSync(this.workDir, { recursive: true });
      fs.renameSync(
        this.input,
        `${this.config.assetsDir}/processed/${path.basename(
          this.input.toString(),
        )}`,
      );

      await this.reporter.updateStepStatus(
        this.ingestWorkflow.id,
        step.id,
        "success",
      );
    } catch (e) {
      logger.error("Cleanup failed:", e);
      await this.reporter.updateStepStatus(
        this.ingestWorkflow.id,
        step.id,
        "failed",
      );
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
