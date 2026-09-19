import { Inject, Injectable } from "@nestjs/common";
import axios, { isAxiosError } from "axios";
import type { Readable } from "stream";
import { downloadsConfig } from "../../config/configuration";
import type { DownloadsConfigType } from "../../config/configuration";

const NZBGEEK_API_URL = "https://api.nzbgeek.info/api";

/** The NZBGeek indexer: NZB files by id. */
@Injectable()
export class NzbGeekClient {
  constructor(
    @Inject(downloadsConfig.KEY)
    private readonly downloads: DownloadsConfigType,
  ) {}

  /**
   * The NZB file of a release, as a stream. The API key is a query
   * parameter, so an Axios error (its config, the request) carries it;
   * failures are rethrown without them.
   */
  async getNzb(nzbId: string): Promise<Readable> {
    try {
      const response = await axios.get<Readable>(NZBGEEK_API_URL, {
        params: { t: "get", id: nzbId, apikey: this.downloads.nzbGeekApiKey },
        responseType: "stream",
      });
      return response.data;
    } catch (e) {
      const reason = isAxiosError(e)
        ? (e.response?.status ?? e.code ?? "no response")
        : "unknown error";
      // No `cause`: the Axios error is what carries the key.
      // eslint-disable-next-line preserve-caught-error
      throw new Error(`NZBGeek NZB ${nzbId} download failed: ${reason}`);
    }
  }
}
