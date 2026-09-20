import {
  createCertification,
  createCollection,
  createCountry,
  createGenre,
  createKeyword,
  createLanguage,
  createMovie,
  createNetwork,
  createPerson,
  createProductionCompany,
  createTvSeries,
  createTvSeriesEpisode,
  createTvSeriesSeason,
  describeMovie,
  describeTvEpisode,
  describeTvSeason,
  describeTvSeries,
  getTvEpisodeById,
  type PartialCertification,
  type PartialCollection,
  type PartialCountry,
  type PartialEpisode,
  type PartialGenre,
  type PartialKeyword,
  type PartialLanguage,
  type PartialMovie,
  type PartialNetwork,
  type PartialPerson,
  type PartialProductionCompany,
  type PartialSeason,
  type PartialTvSeries,
} from "@ncfritz/olympus-sdk/dionysus";
import type { OlympusClients } from "../clients";

/** Dionysus metadata: movies, TV and the entities around them. */
export class MetadataApi {
  constructor(private readonly clients: OlympusClients) {}

  async describeMovie(movieId: number) {
    const response = await describeMovie({
      client: this.clients.dionysus,
      path: { movieId },
    });
    return response.data.movie;
  }

  async createMovie(movie: PartialMovie) {
    const response = await createMovie({
      client: this.clients.dionysus,
      body: { movie },
    });
    return response.data.movie;
  }

  async describeTvSeries(tvSeriesId: number) {
    const response = await describeTvSeries({
      client: this.clients.dionysus,
      path: { tvSeriesId },
    });
    return response.data.tvSeries;
  }

  /** The series with its id, and the ids of what was created with it. */
  async createTvSeries(tvSeries: PartialTvSeries) {
    const response = await createTvSeries({
      client: this.clients.dionysus,
      body: { tvSeries },
    });
    return response.data;
  }

  async describeTvSeason(tvSeriesId: number, seasonNumber: number) {
    const response = await describeTvSeason({
      client: this.clients.dionysus,
      path: { tvSeriesId, seasonNumber },
    });
    return response.data.season;
  }

  async createTvSeriesSeason(seriesId: number, season: PartialSeason) {
    const response = await createTvSeriesSeason({
      client: this.clients.dionysus,
      path: { seriesId },
      body: { season },
    });
    return response.data;
  }

  async describeTvEpisode(
    tvSeriesId: number,
    seasonNumber: number,
    episodeNumber: number,
  ) {
    const response = await describeTvEpisode({
      client: this.clients.dionysus,
      path: { tvSeriesId, seasonNumber, episodeNumber },
    });
    return response.data.episode;
  }

  async getTvEpisodeById(episodeId: number) {
    const response = await getTvEpisodeById({
      client: this.clients.dionysus,
      path: { episodeId },
    });
    return response.data.episode;
  }

  async createTvSeriesEpisode(
    seriesId: number,
    seasonNumber: number,
    episode: PartialEpisode,
  ) {
    const response = await createTvSeriesEpisode({
      client: this.clients.dionysus,
      path: { seriesId, seasonNumber },
      body: { episode },
    });
    return response.data;
  }

  async createPerson(person: PartialPerson) {
    const response = await createPerson({
      client: this.clients.dionysus,
      body: { person },
    });
    return response.data;
  }

  async createCertification(certification: PartialCertification) {
    const response = await createCertification({
      client: this.clients.dionysus,
      body: { certification },
    });
    return response.data.certification;
  }

  /** The collection's id. */
  async createCollection(collection: PartialCollection) {
    const response = await createCollection({
      client: this.clients.dionysus,
      body: { collection },
    });
    return response.data.id;
  }

  async createCountry(country: PartialCountry) {
    const response = await createCountry({
      client: this.clients.dionysus,
      body: { country },
    });
    return response.data.country;
  }

  async createGenre(genre: PartialGenre) {
    const response = await createGenre({
      client: this.clients.dionysus,
      body: { genre },
    });
    return response.data.genre;
  }

  async createKeyword(keyword: PartialKeyword) {
    const response = await createKeyword({
      client: this.clients.dionysus,
      body: { keyword },
    });
    return response.data.keyword;
  }

  async createLanguage(language: PartialLanguage) {
    const response = await createLanguage({
      client: this.clients.dionysus,
      body: { language },
    });
    return response.data.language;
  }

  async createNetwork(network: PartialNetwork) {
    const response = await createNetwork({
      client: this.clients.dionysus,
      body: { network },
    });
    return response.data.network;
  }

  async createProductionCompany(company: PartialProductionCompany) {
    const response = await createProductionCompany({
      client: this.clients.dionysus,
      body: { company },
    });
    return response.data.company;
  }
}
