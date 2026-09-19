import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import type {
  MetadataFetchJob,
  PartialMovie,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import moment from "moment";
import type { FetchJobStore } from "../../fetchJobs/FetchJobStore";
import { ENTITY_SUBSCRIPTIONS, type MetadataJobMessage } from "../../messaging";
import { toMovie } from "../mappers/movie";
import { EntityHandler } from "./EntityHandler";

/** A movie, with its credits, images, videos, release dates and recommendations. */
@Injectable()
export class MovieMetadataHandler extends EntityHandler<
  PartialMovie,
  undefined
> {
  @RabbitSubscribe(ENTITY_SUBSCRIPTIONS.movies)
  public async handle(msg: MetadataJobMessage): Promise<void> {
    await this.fetch(msg);
  }

  async doFetchMetadata(
    entityId: string,
    _metadataFetchJob: MetadataFetchJob,
    _metadataManager: FetchJobStore,
  ): Promise<[PartialMovie, undefined]> {
    const movieId = parseInt(entityId);

    const movieResponse = await this.tmdbClient.getMovieDetails(movieId, [
      "alternative_titles",
      "credits",
      "external_ids",
      "images",
      "keywords",
      "release_dates",
      "videos",
    ]);

    const recommendationsResponse =
      await this.tmdbClient.getMovieRecommendations(movieId, {
        language: "en-US",
        page: 1,
      });

    const movie = toMovie(movieResponse, recommendationsResponse);

    await this.metadataApi.createMovie(movie);

    return [movie, undefined];
  }

  protected getTtl(metadata: PartialMovie): number {
    // For anything that doesn't have a release date, refresh within ~2 weeks
    let ttl = Math.max(14, Math.floor(Math.random() * 180));

    // If there is a release date, calculate the TTL based on the age of the release.  Chances are information
    // will not be updated frequently once a movie is released and even less frequently as it ages.
    //
    // Rules (plus up to a few days, spreading the refreshes out):
    // - Future release: weekly updates (7-9 days)
    // - Within 90 days: monthly updates (30-36 days)
    // - Within a year: 90 day updates (90-119 days)
    // - Otherwise: 180 day updates (180-239 days)
    if (metadata.releaseDate) {
      const daysSinceRelease = moment.utc().diff(metadata.releaseDate, "days");

      if (daysSinceRelease < 0) {
        ttl = 7 + Math.floor(Math.random() * 3);
      } else if (daysSinceRelease < 90) {
        ttl = 30 + Math.floor(Math.random() * 7);
      } else if (daysSinceRelease < 365) {
        ttl = 90 + Math.floor(Math.random() * 30);
      } else {
        ttl = 180 + Math.floor(Math.random() * 60);
      }
    }

    return ttl;
  }

  protected getJitter(_metadata: PartialMovie): number {
    return Math.floor(Math.random() * 14 * 24 * 60);
  }
}
