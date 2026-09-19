import { Inject, Injectable } from "@nestjs/common";
import axios, { isAxiosError } from "axios";
import { nzbGeekConfig } from "../../config/configuration";
import type { NzbGeekConfigType } from "../../config/configuration";

/** A newznab `attr` element: extended attributes such as guid and size. */
export type NewznabAttribute = {
  "@attributes": { name: string; value: string };
};

/** One release in a newznab JSON feed. */
export type NewznabItem = {
  title: string;
  attr: NewznabAttribute[];
};

/** A newznab JSON feed; `item` is absent when nothing matched. */
export type NewznabFeed = {
  channel: { item?: NewznabItem[] };
};

export type NewznabResponse = {
  status: number;
  data: NewznabFeed;
};

/** The value of a release's extended attribute. */
export const newznabAttribute = (
  item: NewznabItem,
  name: string,
): string | undefined =>
  item.attr.find((attr) => attr["@attributes"].name === name)?.["@attributes"]
    .value;

/** The NZBGeek indexer (newznab API): the first 200 releases of a search. */
@Injectable()
export class NzbGeekClient {
  constructor(
    @Inject(nzbGeekConfig.KEY) private readonly nzbGeek: NzbGeekConfigType,
  ) {}

  /** Releases of a movie by IMDb ID (without the `tt` prefix). */
  async searchMovie(imdbId: string): Promise<NewznabResponse> {
    return this.search({ t: "movie", imdbid: imdbId });
  }

  /** Releases of a TV episode by TVDB ID and an `SxxEyy` query. */
  async searchTvEpisode(
    tvdbId: string,
    query: string,
  ): Promise<NewznabResponse> {
    return this.search({ t: "tvsearch", q: query, tvdbid: tvdbId });
  }

  /**
   * The API key is a query parameter, so an Axios error (its config, the
   * request) carries it; failures are rethrown without them.
   */
  private async search(
    parameters: Record<string, string>,
  ): Promise<NewznabResponse> {
    try {
      const response = await axios.get<NewznabFeed>(this.nzbGeek.apiUrl, {
        params: {
          ...parameters,
          limit: 200,
          offset: 0,
          extended: 1,
          o: "json",
          apikey: this.nzbGeek.apiKey,
        },
      });
      return { status: response.status, data: response.data };
    } catch (e) {
      const reason = isAxiosError(e)
        ? (e.response?.status ?? e.code ?? "no response")
        : "unknown error";
      // No `cause`: the Axios error is what carries the key.
      // eslint-disable-next-line preserve-caught-error
      throw new Error(`NZBGeek ${parameters.t} search failed: ${reason}`);
    }
  }
}
