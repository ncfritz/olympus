import axios from "axios";
import { createWriteStream } from "fs";
import { Moment } from "moment";
import LineByLine from "n-readlines";
import lineByLine from "n-readlines";
import fs from "node:fs";
import stream from "stream";
import { promisify } from "util";
import { v4 as uuidv4 } from "uuid";
import { createGunzip } from "zlib";
import { logger } from "../../util/logger";
import { BaseBatchHandler } from "./BaseBatchHandler";

export abstract class BaseExportBatchHandler extends BaseBatchHandler {
  private tempFile = `/tmp/${uuidv4()}.json`;
  private reader: LineByLine;
  private recordCount = 0;

  abstract getExportPrefix(): string;

  protected async init(now: Moment) {
    const dataUrl = `https://files.tmdb.org/p/exports/${this.getExportPrefix()}_ids_${now.format(
      "MM_DD_YYYY",
    )}.json.gz`;
    await this.downloadFile(dataUrl, this.tempFile);

    this.reader = new lineByLine(this.tempFile);
    this.recordCount = 0;

    while (this.reader.next()) {
      this.recordCount++;
    }

    this.reader = new LineByLine(this.tempFile);
  }

  protected async cleanup() {
    logger.debug(`Cleaning up temp file ${this.tempFile}`);

    if (fs.existsSync(this.tempFile)) {
      fs.rmSync(this.tempFile);
    }

    await super.cleanup();
  }

  protected async nextRecord(): Promise<string | undefined> {
    const buffer = this.reader.next();

    return buffer ? buffer.toString("utf-8") : undefined;
  }

  protected async downloadFile(
    url: string,
    destination: string,
  ): Promise<void> {
    logger.debug(`Downloading ${url} and staging to ${destination}`);

    const finished = promisify(stream.finished);
    const writer = createWriteStream(destination);

    await axios.get(url, { responseType: "stream" }).then((response) => {
      response.data.pipe(createGunzip()).pipe(writer);
      return finished(writer);
    });
  }

  protected getRecordCount(): number {
    return this.recordCount;
  }

  protected getTtl(): number {
    return Math.floor(Math.random() * 300);
  }

  protected getJitter(): number {
    return Math.floor(Math.random() * 14 * 24 * 60);
  }
}
