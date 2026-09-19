import {
  describeMovie,
  describeTvEpisode,
  describeTvSeason,
  describeTvSeries,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";

/** Dionysus metadata (movies and TV), through the SDK. */
@Injectable()
export class MetadataApi {
  async describeMovie(movieId: number) {
    const response = await describeMovie({ path: { movieId } });
    return response.data.movie;
  }

  async describeTvSeries(tvSeriesId: number) {
    const response = await describeTvSeries({ path: { tvSeriesId } });
    return response.data.tvSeries;
  }

  async describeTvSeason(tvSeriesId: number, seasonNumber: number) {
    const response = await describeTvSeason({
      path: { tvSeriesId, seasonNumber },
    });
    return response.data.season;
  }

  async describeTvEpisode(
    tvSeriesId: number,
    seasonNumber: number,
    episodeNumber: number,
  ) {
    const response = await describeTvEpisode({
      path: { tvSeriesId, seasonNumber, episodeNumber },
    });
    return response.data.episode;
  }
}
