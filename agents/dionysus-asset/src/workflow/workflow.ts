import { ContentTagType } from "@ncfritz/olympus-model";
import * as cliProgress from "cli-progress";
import { createHash } from "crypto";
import Ffmpeg from "fluent-ffmpeg";
import fs, { PathLike } from "fs";
import moment from "moment/moment";
import path from "path";
import sharp, { OverlayOptions } from "sharp";
import contentAssetsApi from "../api/contentAssets";
import { IngestError } from "../ingest/ingestError";
import sftp from "ssh2-sftp-client";
import progress_stream from "progress-stream";
import { ts } from "../util/format";

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

export class AssetWorkflow {
  private readonly DEFAULT_THUMB_INTERVAL = 5;
  private readonly DEFAULT_THUMB_WIDTH = 200;

  private readonly input: PathLike;
  private readonly workDir: PathLike;
  private readonly assetLocation;
  private readonly mode: MODE;
  private readonly metadata: AssetMetadata;

  private files: string[] = [];
  private isNewAsset = false;
  private tags: PendingTag[] = [];

  constructor(id: string, input: PathLike, workDir: PathLike, mode: MODE) {
    this.input = input;
    this.workDir = workDir;
    this.mode = mode;

    let assetOriginalName = path.basename(input.toString());

    if (assetOriginalName.indexOf(".") > 0) {
      assetOriginalName = assetOriginalName.substring(
        0,
        assetOriginalName.lastIndexOf(".")
      );
    }

    this.metadata = {
      id: id,
      created_date: moment.utc().toISOString(),
      name: assetOriginalName,
    };

    this.assetLocation = `${workDir}/asset.mp4`;
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
    } catch (e) {
      console.log(e);
    }

    console.log(this.files);
  }

  calculateInputSha() {
    const p = new Promise<void>((resolve, reject) => {
      console.log("Generating SHA-256 of input...");
      const readableStream = fs.createReadStream(this.input);
      const hash = createHash("sha256");
      const stat = fs.statSync(this.input);

      readableStream.on("data", (chunk) => {
        hash.update(chunk);
      });
      readableStream.on("end", async () => {
        const digest = hash.digest("hex");
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
              this.input.toString()
            )}`
          );

          reject(new IngestError(`Duplicate asset found with SHA ${digest}`));
        }

        resolve();
      });
    });

    return p;
  }

  calculateOutputSha() {
    const p = new Promise<void>((resolve, reject) => {
      console.log("Generating SHA-256 of asset...");
      const readableStream = fs.createReadStream(this.assetLocation);
      const hash = createHash("sha256");

      readableStream.on("data", (chunk) => {
        hash.update(chunk);
      });
      readableStream.on("end", () => {
        const digest = hash.digest("hex");
        this.metadata.outputSha256 = digest;
      });

      resolve();
    });

    return p;
  }

  extractOriginalMetadata(): Promise<void> {
    const p = new Promise<void>((resolve, reject) => {
      console.log("\nExtract original metadata...");

      Ffmpeg.ffprobe(this.input.toString(), async (err, data) => {
        if (err) {
          console.log(err);
          reject(err);
        } else if (!data) {
          reject("Could not fetch metadata");
        } else {
          console.log(`Writing ${this.workDir}/original_metadata.json`);
          fs.writeFileSync(
            `${this.workDir}/original_metadata.json`,
            JSON.stringify(data, null, 2)
          );
          this.metadata.duration = Math.trunc(
            (data.format.duration || 0) * 1000
          );

          for (let i = 0; i < data.streams.length; i++) {
            if (data.streams[i].codec_type === "video") {
              this.metadata.width = data.streams[i].width!;
              this.metadata.height = data.streams[i].height!;

              break;
            }
          }
        }
      });

      this.files.push(`${this.workDir}/original_metadata.json`);

      resolve();
    });

    return p;
  }

  extractNewMetadata() {
    const p = new Promise<void>((resolve, reject) => {
      console.log("\nExtract new metadata....");

      Ffmpeg.ffprobe(this.assetLocation, async (err, data) => {
        if (err) {
          console.log(err);
        } else {
          fs.writeFileSync(
            `${this.workDir}/metadata.json`,
            JSON.stringify(data, null, 2)
          );
        }
      });

      resolve();
    });

    this.files.push(`${this.workDir}/metadata.json`);

    return p;
  }

  generateThumbnails() {
    const p = new Promise<void>((resolve, reject) => {
      console.log("\nGenerate thumbnails...");

      const progress = new cliProgress.SingleBar({}, cliProgress.Presets.rect);
      progress.start(100, 0);

      const command = Ffmpeg(this.assetLocation);
      command.on("end", async function () {
        progress.stop();

        resolve();
      });
      command.on(
        "progress",
        ffmpegOnProgress((p: number, e: any) => {
          progress.update(Math.trunc(p * 100));
        }, 16)
      );
      command.screenshots({
        count: 16,
        size: "?x300",
        filename: "%i.png",
        folder: `${this.workDir}/thumbnails`,
      });

      this.files.push(`${this.workDir}/thumbnails`);
    });

    return p;
  }

  generateScreenshots(): Promise<void> {
    const p = new Promise<void>((resolve, reject) => {
      console.log("\nGenerate screenshots...");

      const progress = new cliProgress.SingleBar({}, cliProgress.Presets.rect);
      progress.start(100, 0);

      const command = Ffmpeg(this.assetLocation);
      command.on("end", async function () {
        progress.stop();

        resolve();
      });
      command.on(
        "progress",
        ffmpegOnProgress((p: number, e: any) => {
          progress.update(Math.trunc(p * 100));
        }, 16)
      );
      command.screenshots({
        count: 16,
        size: "?x640",
        filename: "%i.png",
        folder: `${this.workDir}/screenshots`,
      });

      this.files.push(`${this.workDir}/screenshots`);
    });

    return p;
  }

  transcode(): Promise<void> {
    const p = new Promise<void>((resolve, reject) => {
      console.log("\nTranscode content...");

      const progress = new cliProgress.SingleBar({}, cliProgress.Presets.rect);
      progress.start(100, 0);

      const command = Ffmpeg(this.input.toString());
      command.videoCodec("libx264");
      command.audioCodec("libmp3lame");
      command.on("error", (err) => {
        console.log("An error occurred: " + err.message);
        fs.renameSync(
          this.input,
          `${process.env.ASSETS_DIR}/failed/${path.basename(
            this.input.toString()
          )}`
        );

        process.exit(1);
      });

      command.on("end", async () => {
        progress.stop();
        await this.calculateOutputSha();

        const newStat = fs.statSync(this.assetLocation);
        this.metadata.assetSize = newStat.size;

        resolve();
      });
      command.on(
        "progress",
        ffmpegOnProgress((p: number, e: any) => {
          progress.update(Math.trunc(p * 100));
        }, this.metadata.duration)
      );
      command.saveToFile(this.assetLocation);

      this.files.push(this.assetLocation);
    });

    return p;
  }

  generateTimelapseVideo() {
    const p = new Promise<void>((resolve, reject) => {
      console.log("\nGenerate timelapse video...");

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
      command.on("error", (err) => {
        console.log("An error occurred: " + err.message);
        fs.renameSync(
          this.input,
          `${process.env.ASSETS_DIR}/failed/${path.basename(
            this.input.toString()
          )}`
        );

        process.exit(1);
      });
      command.on("end", async function () {
        progress.stop();

        resolve();
      });
      command.on(
        "progress",
        ffmpegOnProgress((p: number, e: any) => {
          progress.update(Math.trunc(p * 100));
        }, 15)
      );
      command.saveToFile(`${this.workDir}/timelapse.mp4`);
      this.files.push(`${this.workDir}/timelapse.mp4`);
    });

    return p;
  }

  generateSampleVideo() {
    const p = new Promise<void>((resolve, reject) => {
      console.log("\nGenerate sample video...");

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

      command.on("error", (err) => {
        console.log("An error occurred: " + err.message);
        fs.renameSync(
          this.input,
          `${process.env.ASSETS_DIR}/${path.basename(this.input.toString())}`
        );

        process.exit(1);
      });
      command.on("end", async function () {
        progress.stop();

        resolve();
      });
      command.on(
        "progress",
        ffmpegOnProgress((p: number, e: any) => {
          progress.update(Math.trunc(p * 100));
        }, 15)
      );
      command.saveToFile(`${this.workDir}/sample.mp4`);
      this.files.push(`${this.workDir}/sample.mp4`);
    });

    return p;
  }

  generateVideoThumbnails(): Promise<void> {
    const p = new Promise<void>((resolve, reject) => {
      console.log("\nTranscode content...");

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
      command.on("end", async () => {
        progress.stop();

        console.log("Tagging asset");
        this.tags.push({
          name: "video.thumbs",
          type: ContentTagType.SYSTEM,
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
          duration / this.DEFAULT_THUMB_INTERVAL
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
              `Adding sprite: ${file} [x=${x}, y=${y}, w=${thumbWidth}, h=${thumbHeight}]`
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
              },${thumbWidth},${thumbHeight}`
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
          Buffer.from(vtt.join("\n"), "utf-8")
        );

        console.log("Removing 'screens' directory");
        fs.rmdirSync(screensDir, { recursive: true });

        resolve();
      });
      command.on(
        "progress",
        ffmpegOnProgress((p: number, e: any) => {
          progress.update(Math.trunc(p * 100));
        }, this.metadata.duration!)
      );
      command.run();

      this.files.push(spriteFile);
      this.files.push(thumbsFile);
    });

    return p;
  }

  generateHls(): Promise<void> {
    const p = new Promise<void>((resolve, reject) => {
      console.log("\nGenerate HLS segments...");

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
      command.on("end", async () => {
        progress.stop();

        this.tags.push({
          name: "video.hls",
          type: ContentTagType.SYSTEM,
        });
        resolve();
      });
      command.on(
        "progress",
        ffmpegOnProgress((p: number, e: any) => {
          progress.update(Math.trunc(p * 100));
        }, this.metadata.duration)
      );
      command.run();

      this.files.push(segmentsDir);
      this.files.push(playlistFile);
    });

    return p;
  }

  async upload(): Promise<void> {
    fs.writeFileSync(
      `${this.workDir}/record.json`,
      JSON.stringify(this.metadata, null, 2)
    );

    console.log("\nAggregating files...");
    const files = this.walk(this.workDir.toString());

    console.log("Connecting SSH...");
    const client = new sftp();
    await client.connect({
      host: "nfs01.sea.ncfritz.net",
      port: 22,
      username: "content",
      password: "REDACTED",
    });

    for (const file of files) {
      const stat = fs.statSync(file);
      const truncatedPath = file.substring(
        this.workDir.toString().length,
        file.length
      );

      const progress = new cliProgress.SingleBar(
        { format: " {bar} | {filename} | {percent}% | {value}/{total}" },
        cliProgress.Presets.rect
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
        }
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
  }

  copy(): void {
    console.log("\nAggregating files...");
    const files = this.walk(this.workDir.toString());

    for (const file of files) {
      const truncatedPath = file.substring(
        this.workDir.toString().length,
        file.length
      );

      const destination = `/Content/assets/${this.metadata.id}/${truncatedPath}`;
      const remoteDir = destination.substring(0, destination.lastIndexOf("/"));

      fs.mkdirSync(remoteDir, { recursive: true });
      fs.copyFileSync(file, destination);
    }
  }

  async finalize() {
    fs.writeFileSync(
      `${this.workDir}/record.json`,
      JSON.stringify(this.metadata, null, 2)
    );
    this.files.push(`${this.workDir}/record.json`);

    if (this.mode === "local") {
      await this.upload();
    } else {
      this.copy();
    }

    if (this.isNewAsset) {
      await contentAssetsApi.createContentAsset(this.metadata);
    }

    for (const pendingTag of this.tags) {
      await contentAssetsApi.addTag(
        this.metadata.id,
        pendingTag.name,
        pendingTag.type
      );
    }

    console.log("\nCleanup...");
    fs.rmSync(this.workDir, { recursive: true });
    fs.renameSync(
      this.input,
      `${process.env.ASSETS_DIR}/processed/${path.basename(
        this.input.toString()
      )}`
    );
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
