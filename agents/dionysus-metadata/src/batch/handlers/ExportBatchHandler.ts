import { Injectable } from "@nestjs/common";
import { ExportFileSource, type ExportLine } from "../sources/ExportFileSource";
import { BatchHandler } from "./BatchHandler";

/**
 * A batch job over a TMDB daily ID export: queues a fetch of every entity
 * that is new or due.
 */
@Injectable()
export abstract class ExportBatchHandler extends BatchHandler<ExportLine> {
  /** The export's name, e.g. `movie` for `movie_ids_<date>.json.gz`. */
  protected abstract getExportPrefix(): string;

  protected createSource(): ExportFileSource {
    return new ExportFileSource(this.getExportPrefix());
  }

  protected getTtl(): number {
    return Math.floor(Math.random() * 300);
  }

  protected getJitter(): number {
    return Math.floor(Math.random() * 14 * 24 * 60);
  }
}
