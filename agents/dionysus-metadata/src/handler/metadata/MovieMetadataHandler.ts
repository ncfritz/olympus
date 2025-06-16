import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import {
  JobType,
  MetadataFetchJob,
  PartialMovie,
  PartialMovieAlternativeTitle,
  PartialMovieCastMember,
  PartialMovieCrewMember,
  PartialMovieExternalId,
  PartialMovieGenre,
  PartialMovieImage,
  PartialMovieKeyword,
  PartialMovieProductionCompany,
  PartialMovieProductionCountry,
  PartialMovieReleaseDate,
  PartialMovieSpokenLanguage,
  PartialMovieVideo,
} from "@ncfritz/olympus-model";
import { Injectable } from "@nestjs/common";
import { ConsumeMessage } from "amqplib";
import moment from "moment";
import { MoviesEndpoint } from "tmdb-ts/dist/endpoints";
import metadataApi from "../../api/metadataApi";
import { MetadataJobMessage } from "../../types/message";
import {
  JOB_TYPE_PREFIX,
  METADATA_JOB_PREFIX,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import { UniqueSet } from "../../util/UniqueSet";
import { BaseMetadataHandler } from "./BaseMetadataHandler";

@Injectable()
export class MoviesMetadataHandler extends BaseMetadataHandler<
  PartialMovie,
  undefined
> {
  @RabbitSubscribe({
    exchange: `${METADATA_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${METADATA_JOB_PREFIX}.${JobType.MOVIES}.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.${JobType.MOVIES}`,
    queueOptions: {
      channel: "metadataChannel",
    },
    errorBehavior: MessageHandlerErrorBehavior.ACK,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: MetadataJobMessage, amqpMsg: ConsumeMessage) {
    await this.doFetch(msg);
  }

  async doFetchMetadata(
    entityId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    metadataFetchJob: MetadataFetchJob,
  ): Promise<[PartialMovie, undefined]> {
    const endpoint = new MoviesEndpoint(
      this.configService.get<string>("TMDB_API_KEY")!,
    );

    const movieId = parseInt(entityId);

    const movieResponse = await endpoint.details(movieId, [
      "alternative_titles",
      "credits",
      "external_ids",
      "images",
      "keywords",
      "release_dates",
      "videos",
    ]);

    const movie = new PartialMovie();
    movie.id = movieResponse.id;
    movie.adult = movieResponse.adult;
    movie.backdropPath = movieResponse.backdrop_path;
    movie.budget = movieResponse.budget;
    movie.homepage = movieResponse.homepage;
    movie.imdbId = movieResponse.imdb_id;
    movie.originalLanguageCode = movieResponse.original_language;
    movie.originalTitle = movieResponse.original_title;
    movie.overview = movieResponse.overview;
    movie.posterPath = movieResponse.poster_path;
    movie.releaseDate = moment(movieResponse.release_date);
    movie.revenue = movieResponse.revenue;
    movie.runtime = movieResponse.runtime;
    movie.status = movieResponse.status;
    movie.tagline = movieResponse.tagline;
    movie.title = movieResponse.title;
    movie.video = movieResponse.video;

    const alternativeTitles: UniqueSet<PartialMovieAlternativeTitle> =
      new UniqueSet();

    movieResponse.alternative_titles.titles.forEach((value) => {
      alternativeTitles.add({
        title: value.title,
        type: value.type,
        countryCode: value.iso_3166_1,
      });
    });

    const cast: UniqueSet<PartialMovieCastMember> = new UniqueSet();

    movieResponse.credits.cast.forEach((value) => {
      cast.add({
        personId: value.id,
        castId: value.cast_id,
        creditId: value.credit_id,
        originalName: value.original_name,
        character: value.character,
        order: value.order,
      });
    });

    const crew: UniqueSet<PartialMovieCrewMember> = new UniqueSet();

    movieResponse.credits.crew.forEach((value) => {
      crew.add({
        personId: value.id,
        creditId: value.credit_id,
        originalName: value.original_name,
        department: value.department,
        job: value.job,
      });
    });

    const externalIds: UniqueSet<PartialMovieExternalId> = new UniqueSet();

    if (movieResponse.external_ids) {
      if (movieResponse.external_ids.imdb_id) {
        externalIds.add({
          type: "imdb",
          externalId: `${movieResponse.external_ids.imdb_id}`,
        });
      }

      if (movieResponse.external_ids["wikidata_id"]) {
        externalIds.add({
          type: "wikidata",
          externalId: `${movieResponse.external_ids["wikidata_id"]}`,
        });
      }

      if (movieResponse.external_ids.facebook_id) {
        externalIds.add({
          type: "facebook",
          externalId: `${movieResponse.external_ids.facebook_id}`,
        });
      }

      if (movieResponse.external_ids.instagram_id) {
        externalIds.add({
          type: "instagram",
          externalId: `${movieResponse.external_ids.instagram_id}`,
        });
      }

      if (movieResponse.external_ids.twitter_id) {
        externalIds.add({
          type: "twitter",
          externalId: `${movieResponse.external_ids.twitter_id}`,
        });
      }
    }

    const genres: UniqueSet<PartialMovieGenre> = new UniqueSet();

    movieResponse.genres.forEach((value) => {
      genres.add({
        genreId: value.id,
      });
    });

    const images: UniqueSet<PartialMovieImage> = new UniqueSet();

    movieResponse.images.logos.forEach((value) => {
      images.add({
        type: "logo",
        filePath: value.file_path,
        width: value.width,
        height: value.height,
        countryCode: value.iso_639_1 || "en",
      });
    });

    movieResponse.images.backdrops.forEach((value) => {
      images.add({
        type: "backdrop",
        filePath: value.file_path,
        width: value.width,
        height: value.height,
        countryCode: value.iso_639_1 || "en",
      });
    });

    movieResponse.images.posters.forEach((value) => {
      images.add({
        type: "poster",
        filePath: value.file_path,
        width: value.width,
        height: value.height,
        countryCode: value.iso_639_1 || "en",
      });
    });

    const keywords: UniqueSet<PartialMovieKeyword> = new UniqueSet();

    movieResponse.keywords.keywords.forEach((value) => {
      keywords.add({
        keywordId: value.id,
      });
    });

    const productionCompanies: UniqueSet<PartialMovieProductionCompany> =
      new UniqueSet();

    movieResponse.production_companies.forEach((value) => {
      productionCompanies.add({
        productionCompanyId: value.id,
      });
    });

    const productionCountries: UniqueSet<PartialMovieProductionCountry> =
      new UniqueSet();

    movieResponse.production_countries.forEach((value) => {
      productionCountries.add({
        countryId: value.iso_3166_1,
      });
    });

    const releaseDates: UniqueSet<PartialMovieReleaseDate> = new UniqueSet();

    movieResponse.release_dates.results.forEach((wrapper) => {
      const countryCode = wrapper.iso_3166_1;

      wrapper.release_dates.forEach((value) => {
        releaseDates.add({
          type: value.type,
          countryId: countryCode,
          releaseDate: moment(value.release_date),
          languageId: value.iso_639_1,
          certificationId: value.certification,
          note: value.note,
        });
      });
    });

    const spokenLanguages: UniqueSet<PartialMovieSpokenLanguage> =
      new UniqueSet();

    movieResponse.spoken_languages.forEach((value) => {
      spokenLanguages.add({
        languageId: value.iso_639_1,
      });
    });

    const videos: UniqueSet<PartialMovieVideo> = new UniqueSet();

    movieResponse.videos.results.forEach((value) => {
      videos.add({
        type: value.type,
        countryId: value.iso_3166_1,
        languageId: value.iso_639_1,
        name: value.name,
        id: value.id,
        key: value.key,
        site: value.site,
        size: value.size,
        // @ts-expect-error external api
        official: value["official"] as boolean,
        // @ts-expect-error external api
        publishedTime: moment(value["published_at"]),
      });
    });

    movie.alternativeTitles = [...alternativeTitles];
    movie.cast = [...cast];
    movie.crew = [...crew];
    movie.externalIds = [...externalIds];
    movie.genres = [...genres];
    movie.images = [...images];
    movie.keywords = [...keywords];
    movie.productionCompanies = [...productionCompanies];
    movie.productionCountries = [...productionCountries];
    movie.releaseDates = [...releaseDates];
    movie.spokenLanguages = [...spokenLanguages];
    movie.videos = [...videos];

    await metadataApi.createMovie(movie);

    return [movie, undefined];
  }

  protected getTtl(metadata: PartialMovie): number {
    // For anything that doesn't have a release date, refresh within ~2 weeks
    let ttl = Math.max(14, Math.floor(Math.random() * 180));

    // If there is a release date, calculate the TTL based on the age of the release.  Chances are information
    // will not be updated frequently once a movie is released and even less frequently as it ages.
    //
    // Rules:
    // - Future release: weekly updates
    // - Within 90 days: monthly updates
    // - Within a year: 90 day updates
    // - Otherwise: 180 day updates
    if (metadata.releaseDate) {
      const daysSinceRelease = moment.utc().diff(metadata.releaseDate, "days");

      if (daysSinceRelease < 0) {
        ttl = Math.max(7, Math.floor(Math.random() * 3));
      } else if (daysSinceRelease < 90) {
        ttl = Math.max(30, Math.floor(Math.random() * 7));
      } else if (daysSinceRelease < 365) {
        ttl = Math.max(90, Math.floor(Math.random() * 30));
      } else {
        ttl = Math.max(180, Math.floor(Math.random() * 60));
      }
    }

    return ttl;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getJitter(metadata: PartialMovie): number {
    return Math.floor(Math.random() * 14 * 24 * 60);
  }

  protected cleanup(): Promise<void> {
    return Promise.resolve();
  }
}
