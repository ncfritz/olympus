import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable } from "@nestjs/common";
import { MediaApi } from "../../api/MediaApi";
import { MetadataApi } from "../../api/MetadataApi";
import { NotificationApi } from "../../api/NotificationApi";
import {
  SEARCH_SUBSCRIPTIONS,
  type SearchExecutionMessage,
} from "../../messaging";
import { NzbGeekClient } from "../services/NzbGeekClient";
import {
  SearchHandler,
  searchResult,
  type SearchResult,
} from "./SearchHandler";

/** Searches the indexer for a movie's releases by IMDb ID. */
@Injectable()
export class MovieSearchHandler extends SearchHandler {
  constructor(
    mediaApi: MediaApi,
    notificationApi: NotificationApi,
    private readonly metadataApi: MetadataApi,
    private readonly nzbGeek: NzbGeekClient,
  ) {
    super(mediaApi, notificationApi);
  }

  @RabbitSubscribe(SEARCH_SUBSCRIPTIONS.movie)
  public async handle(msg: SearchExecutionMessage): Promise<void> {
    await this.execute("movie", msg);
  }

  protected async doSearch(msg: SearchExecutionMessage): Promise<SearchResult> {
    const result = searchResult("success");

    this.logger.log(`Fetching movie definition: ${msg.mediaId}`);
    const movie = await this.metadataApi.describeMovie(msg.mediaId);

    const imdbId = movie.externalIds.find((item) => item.type === "imdb");

    if (!imdbId) {
      this.logger.warn("No IMDB ID found, marking search as skipped");
      result.status = "skipped";
      return result;
    }

    this.logger.log(`Found IMDB ID ${imdbId.externalId}`);

    const searchId = imdbId.externalId.toLowerCase().startsWith("tt")
      ? imdbId.externalId.substring(2)
      : imdbId.externalId;

    const response = await this.nzbGeek.searchMovie(searchId);

    if (response.status !== 200) {
      result.status = "failed";
      return result;
    }

    const items = response.data.channel.item;

    if (!items) {
      this.logger.log(
        `No results found for media ID ${msg.mediaId}... skipping`,
      );
      result.status = "skipped";
      return result;
    }

    await this.recordResults("movie", msg.mediaId, items, result);
    return result;
  }
}
