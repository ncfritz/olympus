import { Inject, Injectable } from "@nestjs/common";
import axios from "axios";
import type { Readable } from "stream";
import { downloadsConfig } from "../../config/configuration";
import type { DownloadsConfigType } from "../../config/configuration";

/** The NZBGeek indexer: NZB files by id. */
@Injectable()
export class NzbGeekClient {
  constructor(
    @Inject(downloadsConfig.KEY)
    private readonly downloads: DownloadsConfigType,
  ) {}

  /** The NZB file of a release, as a stream. */
  async getNzb(nzbId: string): Promise<Readable> {
    const url = `https://api.nzbgeek.info/api?t=get&id=${nzbId}&apikey=${this.downloads.nzbGeekApiKey}`;
    const response = await axios.get(url, { responseType: "stream" });
    return response.data;
  }
}
