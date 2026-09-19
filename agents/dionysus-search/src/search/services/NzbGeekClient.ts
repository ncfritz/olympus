import { Inject, Injectable } from "@nestjs/common";
import axios from "axios";
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
    return this.search(`t=movie&imdbid=${imdbId}`);
  }

  /** Releases of a TV episode by TVDB ID and an `SxxEyy` query. */
  async searchTvEpisode(
    tvdbId: string,
    query: string,
  ): Promise<NewznabResponse> {
    return this.search(`t=tvsearch&q=${query}&tvdbid=${tvdbId}`);
  }

  private async search(parameters: string): Promise<NewznabResponse> {
    const offset = 0;
    const url = `${this.nzbGeek.apiUrl}?${parameters}&limit=200&offset=${offset}&extended=1&o=json&apikey=${this.nzbGeek.apiKey}`;
    const response = await axios.get<NewznabFeed>(url);
    return { status: response.status, data: response.data };
  }
}
