import {
  client,
  describeMovie,
  getTvEpisodeById,
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

const metadataApi = new MetadataApi();
export default metadataApi;
