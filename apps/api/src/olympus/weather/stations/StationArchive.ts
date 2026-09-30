import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import {
  appendFile,
  mkdir,
  readdir,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createZstdCompress } from "node:zlib";
import { Inject, Injectable, Logger } from "@nestjs/common";
import moment, { type Moment } from "moment";
import {
  weatherConfig,
  type WeatherConfigType,
} from "../../../config/configuration";
import { recordArchive } from "../weatherMetrics";

/** One line of the archive: a push as received, or a backfill response. */
export type ArchiveLine = {
  receivedAt: string;
  source: "push" | "backfill";
  /** The address the push came from, as the API saw it. */
  remote?: string;
  /** The push's query string, exactly as received. */
  query?: string;
  /** A backfill response body. Never the request, which carries the keys. */
  response?: unknown;
};

const DAY_FILE = /^(\d{2})\.jsonl$/;

/**
 * The raw station archive (ADR 0024): the source of truth the samples and
 * rollups can be rebuilt from, so the weather tables need no backup.
 *
 * `<dir>/<mac>/<yyyy>/<mm>/<dd>.jsonl`, one line per push in the order
 * received, by the UTC day it was received (the MAC with dashes: the copy
 * lands on an SMB share, where a colon is not allowed in a name). The first
 * write of a new day seals every earlier day: compressed with zstd to
 * `<dd>.jsonl.zst`, beside `<dd>.jsonl.zst.sha256` in `sha256sum` format
 * so the NAS copy can be checked, and the plain file removed.
 */
@Injectable()
export class StationArchive {
  private readonly logger = new Logger(StationArchive.name);
  /** Per station, the last day written, so sealing runs once a day. */
  private readonly lastDay = new Map<string, string>();

  constructor(
    @Inject(weatherConfig.KEY) private readonly weather: WeatherConfigType,
  ) {}

  /**
   * Appends a line. A failure is logged and counted and answers false: the
   * sample is still stored, and the push is not refused over the archive.
   */
  async append(macAddress: string, line: ArchiveLine): Promise<boolean> {
    const received = moment.utc(line.receivedAt);
    const station = stationDirectory(macAddress);
    const file = this.dayFile(station, received);
    try {
      await mkdir(join(file, ".."), { recursive: true });
      await appendFile(file, JSON.stringify(line) + "\n", "utf8");
      recordArchive("written");
    } catch (error) {
      recordArchive("failed");
      this.logger.error(
        `Could not archive a ${line.source} for ${macAddress}: ${describe(error)}`,
      );
      return false;
    }

    const day = received.format("YYYY-MM-DD");
    if (this.lastDay.get(station) !== day) {
      this.lastDay.set(station, day);
      await this.sealBefore(station, day);
    }
    return true;
  }

  /** Where a station's archive lives; for replay and the tests. */
  directoryFor(macAddress: string): string {
    return join(this.weather.stations.archiveDir, stationDirectory(macAddress));
  }

  private dayFile(station: string, at: Moment): string {
    return join(
      this.weather.stations.archiveDir,
      station,
      at.format("YYYY"),
      at.format("MM"),
      `${at.format("DD")}.jsonl`,
    );
  }

  /** Seals every day file of a station older than `today`. */
  private async sealBefore(station: string, today: string): Promise<void> {
    const root = join(this.weather.stations.archiveDir, station);
    for (const file of await dayFiles(root)) {
      if (file.day >= today) continue;
      try {
        await seal(file.path);
        recordArchive("sealed");
      } catch (error) {
        recordArchive("seal_failed");
        this.logger.error(`Could not seal ${file.path}: ${describe(error)}`);
      }
    }
  }
}

/** A day file compressed, its checksum written, the plain file removed. */
export const seal = async (path: string): Promise<void> => {
  const target = `${path}.zst`;
  const partial = `${target}.partial`;
  const hash = createHash("sha256");
  await pipeline(
    createReadStream(path),
    createZstdCompress(),
    new Transform({
      transform(chunk, _encoding, done) {
        hash.update(chunk);
        done(null, chunk);
      },
    }),
    createWriteStream(partial),
  );
  // Renamed only once whole, so a crash never leaves a truncated .zst
  // looking finished; the checksum is written after, so a .zst without
  // one is one that has not been finished yet.
  await rename(partial, target);
  const name = target.slice(target.lastIndexOf("/") + 1);
  await writeFile(`${target}.sha256`, `${hash.digest("hex")}  ${name}\n`);
  await unlink(path);
};

/** Every plain day file under a station's directory, with its date. */
const dayFiles = async (
  root: string,
): Promise<{ path: string; day: string }[]> => {
  const found: { path: string; day: string }[] = [];
  for (const year of await names(root)) {
    for (const month of await names(join(root, year))) {
      for (const file of await names(join(root, year, month))) {
        const match = DAY_FILE.exec(file);
        if (match) {
          found.push({
            path: join(root, year, month, file),
            day: `${year}-${month}-${match[1]}`,
          });
        }
      }
    }
  }
  return found;
};

const names = async (directory: string): Promise<string[]> => {
  try {
    return await readdir(directory);
  } catch {
    return [];
  }
};

export const stationDirectory = (macAddress: string) =>
  macAddress.replace(/:/g, "-").toUpperCase();

const describe = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
