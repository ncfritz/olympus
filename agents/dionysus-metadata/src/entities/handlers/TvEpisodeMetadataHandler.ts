import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import type {
  MetadataFetchJob,
  PartialEpisode,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import moment from "moment";
import type { FetchJobStore } from "../../fetchJobs/FetchJobStore";
import { ENTITY_SUBSCRIPTIONS, type MetadataJobMessage } from "../../messaging";
import { toTvEpisode } from "../mappers/tvEpisode";
import { EntityHandler } from "./EntityHandler";

/** A TV episode (entity id `<series>-<season>-<episode>`). */
@Injectable()
export class TvEpisodeMetadataHandler extends EntityHandler<
  PartialEpisode,
  undefined
> {
  @RabbitSubscribe(ENTITY_SUBSCRIPTIONS.tv_episodes)
  public async handle(msg: MetadataJobMessage): Promise<void> {
    await this.fetch(msg);
  }

  async doFetchMetadata(
    entityId: string,
    metadataFetchJob: MetadataFetchJob,
    _metadataManager: FetchJobStore,
  ): Promise<[PartialEpisode, undefined]> {
    const [seriesId, seasonNumber, episodeNumber] = entityId
      .split("-", 3)
      .map((id) => parseInt(id));

    const episodeResponse = await this.tmdbClient.getTvEpisodeDetails(
      {
        tvShowID: seriesId,
        seasonNumber: seasonNumber,
        episodeNumber: episodeNumber,
      },
      ["external_ids", "images", "credits", "videos"],
    );

    const episode = toTvEpisode(episodeResponse, metadataFetchJob);

    await this.metadataApi.createTvSeriesEpisode(
      seriesId,
      seasonNumber,
      episode,
    );

    return [episode, undefined];
  }

  protected getTtl(metadata: PartialEpisode): number {
    if (metadata.airDate) {
      const now = moment.utc();
      // Positive values indicate the episode has aired in the past, negative values indicate the episode is yet
      // to air
      const delta = now.diff(metadata.airDate, "days");

      if (delta <= 0) {
        return 3;
      } else if (delta < 7) {
        return 7;
      } else if (delta < 30) {
        return 14;
      }
    }

    return Math.max(30, Math.floor(Math.random() * 60));
  }

  protected getJitter(metadata: PartialEpisode): number {
    if (metadata.airDate) {
      const now = moment.utc();
      const delta = now.diff(metadata.airDate, "days");

      if (delta <= 0) {
        return Math.floor(Math.random() * 2 * 24 * 60);
      } else if (delta < 7) {
        return Math.floor(Math.random() * 3 * 24 * 60);
      } else if (delta < 30) {
        return Math.floor(Math.random() * 7 * 24 * 60);
      }
    }

    return Math.floor(Math.random() * 60 * 24 * 60);
  }
}
