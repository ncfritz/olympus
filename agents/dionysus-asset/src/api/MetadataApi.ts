import { Injectable } from "@nestjs/common";
import { describeMovie, getTvEpisodeById } from "@ncfritz/olympus-sdk/dionysus";

/** Dionysus metadata (movies and TV episodes), through the SDK. */
@Injectable()
export class MetadataApi {
  async describeMovie(id: number) {
    const response = await describeMovie({
      path: {
        movieId: id,
      },
    });

    return response.data.movie;
  }

  async getTvEpisodeById(id: number) {
    const response = await getTvEpisodeById({
      path: {
        episodeId: id,
      },
    });

    return response.data.episode;
  }
}
