import {
  client,
  describeMovie,
  describeTvEpisode,
  describeTvSeason,
  describeTvSeries,
} from "@ncfritz/olympus-sdk/dionysus";
import { BASE_URL } from "./apiBase";

class MetadataApi {
  constructor() {
    client.setConfig({
      baseURL: BASE_URL,
      throwOnError: true,
    });
  }

  async describeMovie(id: number) {
    return describeMovie({
      path: {
        movieId: id,
      },
    });
  }

  async describeTvSeries(id: number) {
    return describeTvSeries({
      path: {
        tvSeriesId: id,
      },
    });
  }

  async describeTvSeason(seriesId: number, seasonNumber: number) {
    return describeTvSeason({
      path: {
        tvSeriesId: seriesId,
        seasonNumber: seasonNumber,
      },
    });
  }

  async describeTvEpisode(
    seriesId: number,
    seasonNumber: number,
    episodeNumber: number,
  ) {
    return describeTvEpisode({
      path: {
        tvSeriesId: seriesId,
        seasonNumber: seasonNumber,
        episodeNumber: episodeNumber,
      },
    });
  }
}

const metadataApi = new MetadataApi();
export default metadataApi;
