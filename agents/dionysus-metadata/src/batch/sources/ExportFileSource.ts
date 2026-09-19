import { Logger } from "@nestjs/common";
import axios from "axios";
import { createWriteStream } from "fs";
import type { Moment } from "moment";
import LineByLine from "n-readlines";
import fs from "node:fs";
import stream from "stream";
import { promisify } from "util";
import { v4 as uuidv4 } from "uuid";
import { createGunzip } from "zlib";
import type { RecordSource } from "./RecordSource";

/** A line of a TMDB daily ID export. */
export type ExportLine = {
  id: number;
  /** Keywords, collections, companies, networks. */
  name?: string;
};

const logger = new Logger("ExportFileSource");

/**
 * A TMDB daily ID export (https://developer.themoviedb.org/docs/daily-id-exports),
 * e.g. `movie_ids_09_19_2026.json.gz`: downloaded, unzipped to a temp file
 * and read line by line.
 */
export class ExportFileSource implements RecordSource<ExportLine> {
  private readonly tempFile = `/tmp/${uuidv4()}.json`;
  private reader: LineByLine;
  private recordCount = 0;

  /** @param prefix the export's name, e.g. `movie` */
  constructor(private readonly prefix: string) {}

  async init(now: Moment): Promise<void> {
    const dataUrl = `https://files.tmdb.org/p/exports/${this.prefix}_ids_${now.format(
      "MM_DD_YYYY",
    )}.json.gz`;
    await this.downloadFile(dataUrl, this.tempFile);

    this.reader = new LineByLine(this.tempFile);
    this.recordCount = 0;

    while (this.reader.next()) {
      this.recordCount++;
    }

    this.reader = new LineByLine(this.tempFile);
  }

  async next(): Promise<ExportLine | undefined> {
    const buffer = this.reader.next();
    const line = buffer ? buffer.toString("utf-8") : undefined;

    return line ? (JSON.parse(line) as ExportLine) : undefined;
  }

  count(): number {
    return this.recordCount;
  }

  async cleanup(): Promise<void> {
    logger.debug(`Cleaning up temp file ${this.tempFile}`);

    if (fs.existsSync(this.tempFile)) {
      fs.rmSync(this.tempFile);
    }
  }

  private async downloadFile(url: string, destination: string): Promise<void> {
    logger.debug(`Downloading ${url} and staging to ${destination}`);

    const finished = promisify(stream.finished);
    const writer = createWriteStream(destination);

    await axios.get(url, { responseType: "stream" }).then((response) => {
      response.data.pipe(createGunzip()).pipe(writer);
      return finished(writer);
    });
  }
}
