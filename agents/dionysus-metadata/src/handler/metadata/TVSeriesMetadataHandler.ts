import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import {
  MetadataFetchJob,
  PartialAlternativeTitle,
  PartialCountryAssociation,
  PartialExternalId,
  PartialGenreAssociation,
  PartialKeywordAssociation,
  PartialLanguageAssociation,
  PartialNetworkAssociation,
  PartialProductionCompanyAssociation,
  PartialTvSeries,
  PartialTvSeriesCastMember,
  PartialTvSeriesCertification,
  PartialTvSeriesCreatedBy,
  PartialTvSeriesCrewMember,
  PartialTvSeriesRecommendation,
  PartialTvSeriesRuntime,
  PartialTypedImage,
  PartialVideo
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import { type ConsumeMessage } from "amqplib";
import moment from "moment/moment";
import { AggregateCast, AggregateCrew } from "tmdb-ts";
import { TvShowsEndpoint } from "tmdb-ts/dist/endpoints";
import metadataApi from "../../api/metadataApi";
import { MetadataFetchJobManager } from "../../cache/MetadataFetchJobManager";
import { type MetadataJobMessage } from "../../types/message";
import {
  JOB_TYPE_PREFIX,
  METADATA_JOB_PREFIX,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import { logger } from "../../util/logger";
import { UniqueSet } from "../../util/UniqueSet";
import { BaseMetadataHandler } from "./BaseMetadataHandler";

@Injectable()
export class TVSeriesMetadataHandler extends BaseMetadataHandler<
  PartialTvSeries,
  undefined
> {
  @RabbitSubscribe({
    exchange: `${METADATA_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${METADATA_JOB_PREFIX}.tv_series.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.tv_series`,
    queueOptions: {
      channel: "tvSeriesChannel",
    },
    errorBehavior: MessageHandlerErrorBehavior.ACK,
  })

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: MetadataJobMessage, amqpMsg: ConsumeMessage) {
    await this.doFetch(msg);
  }

  async doFetchMetadata(
    entityId: string,
    metadataFetchJob: MetadataFetchJob,
    metadataManager: MetadataFetchJobManager,
  ): Promise<[PartialTvSeries, undefined]> {
    const endpoint = new TvShowsEndpoint(
      this.configService.get<string>("TMDB_API_KEY")!,
    );

    const seriesId = parseInt(entityId);

    const seriesResponse = await endpoint.details(seriesId, [
      "alternative_titles",
      "content_ratings",
      "external_ids",
      "images",
      "keywords",
      "aggregate_credits",
      "videos",
    ]);

    const recommendationsResponse = await endpoint.recommendations(seriesId, {
      language: "en-US",
      page: 1,
    });

    const recommendations: UniqueSet<PartialTvSeriesRecommendation> =
      new UniqueSet();

    recommendationsResponse.results.forEach((value) => {
      recommendations.add({
        recommendationId: value.id,
      });
    });

    const alternativeTitles: UniqueSet<PartialAlternativeTitle> =
      new UniqueSet();

    // @ts-expect-error API bindings incorrect
    seriesResponse.alternative_titles.results.forEach((value) => {
      alternativeTitles.add({
        title: value.title,
        type: value.type,
        countryCode: value.iso_3166_1,
      });
    });

    const cast: UniqueSet<PartialTvSeriesCastMember> = new UniqueSet();

    // @ts-expect-error - expected per API - TS bindings are incorrect
    seriesResponse.aggregate_credits.cast.forEach((value: AggregateCast) => {
      cast.add({
        personId: value.id,
        order: value.order,
        originalName: value.original_name,
        totalEpisodeCount: value.total_episode_count,
        roles: value.roles.map((role) => {
          return {
            creditId: role.credit_id,
            character: role.character,
            episodeCount: role.episode_count,
          };
        }),
      });
    });

    const certifications: UniqueSet<PartialTvSeriesCertification> =
      new UniqueSet();

    seriesResponse.content_ratings.results.forEach((value) => {
      certifications.add({
        rating: value.rating,
        type: "TV",
        country: value.iso_3166_1,
      });
    });

    const crew: UniqueSet<PartialTvSeriesCrewMember> = new UniqueSet();

    // @ts-expect-error - expected per API - TS bindings are incorrect
    seriesResponse.aggregate_credits.crew.forEach((value: AggregateCrew) => {
      crew.add({
        personId: value.id,
        originalName: value.original_name,
        department: value.department,
        totalEpisodeCount: value.total_episode_count,
        jobs: value.jobs.map((job) => {
          return {
            creditId: job.credit_id,
            job: job.job,
            episodeCount: job.episode_count,
          };
        }),
      });
    });

    const createdBy: UniqueSet<PartialTvSeriesCreatedBy> = new UniqueSet();

    seriesResponse.created_by.forEach((value) => {
      createdBy.add({
        personId: value.id,
        creditId: value.credit_id,
      });
    });

    const episodeRunTimes: UniqueSet<PartialTvSeriesRuntime> = new UniqueSet();

    seriesResponse.episode_run_time.forEach((value) => {
      episodeRunTimes.add({
        runTime: value,
      });
    });

    const externalIds: UniqueSet<PartialExternalId> = new UniqueSet();

    if (seriesResponse.external_ids) {
      if (seriesResponse.external_ids.imdb_id) {
        externalIds.add({
          type: "imdb",
          externalId: `${seriesResponse.external_ids.imdb_id}`,
        });
      }

      if (seriesResponse.external_ids["wikidata_id"]) {
        externalIds.add({
          type: "wikidata",
          externalId: `${seriesResponse.external_ids["wikidata_id"]}`,
        });
      }

      if (seriesResponse.external_ids.facebook_id) {
        externalIds.add({
          type: "facebook",
          externalId: `${seriesResponse.external_ids.facebook_id}`,
        });
      }

      if (seriesResponse.external_ids.instagram_id) {
        externalIds.add({
          type: "instagram",
          externalId: `${seriesResponse.external_ids.instagram_id}`,
        });
      }

      if (seriesResponse.external_ids.twitter_id) {
        externalIds.add({
          type: "twitter",
          externalId: `${seriesResponse.external_ids.twitter_id}`,
        });
      }
    }

    const genres: UniqueSet<PartialGenreAssociation> = new UniqueSet();

    seriesResponse.genres.forEach((value) => {
      genres.add({
        genreId: value.id,
      });
    });

    const images: UniqueSet<PartialTypedImage> = new UniqueSet();

    seriesResponse.images.logos.forEach((value) => {
      images.add({
        type: "logo",
        filePath: value.file_path,
        width: value.width,
        height: value.height,
        languageCode: value.iso_639_1 || "en",
      });
    });

    seriesResponse.images.backdrops.forEach((value) => {
      images.add({
        type: "backdrop",
        filePath: value.file_path,
        width: value.width,
        height: value.height,
        languageCode: value.iso_639_1 || "en",
      });
    });

    seriesResponse.images.posters.forEach((value) => {
      images.add({
        type: "poster",
        filePath: value.file_path,
        width: value.width,
        height: value.height,
        languageCode: value.iso_639_1 || "en",
      });
    });

    const keywords: UniqueSet<PartialKeywordAssociation> = new UniqueSet();

    // @ts-expect-error - expected per API - TS bindings are incorrect
    seriesResponse.keywords.results.forEach((value) => {
      keywords.add({
        keywordId: value.id,
      });
    });

    const languages: UniqueSet<PartialLanguageAssociation> = new UniqueSet();

    seriesResponse.languages.forEach((value) => {
      languages.add({
        languageCode: value,
      });
    });

    const networks: UniqueSet<PartialNetworkAssociation> = new UniqueSet();

    seriesResponse.networks.forEach((value) => {
      networks.add({
        networkId: value.id,
      });
    });

    const originCountries: UniqueSet<PartialCountryAssociation> =
      new UniqueSet();

    seriesResponse.origin_country.forEach((value) => {
      originCountries.add({
        countryCode: value,
      });
    });

    const productionCompanies: UniqueSet<PartialProductionCompanyAssociation> =
      new UniqueSet();

    seriesResponse.production_companies.forEach((value) => {
      productionCompanies.add({
        productionCompanyId: value.id,
      });
    });

    const productionCountries: UniqueSet<PartialCountryAssociation> =
      new UniqueSet();

    seriesResponse.production_countries.forEach((value) => {
      productionCountries.add({
        countryCode: value.iso_3166_1,
      });
    });

    const spokenLanguages: UniqueSet<PartialLanguageAssociation> =
      new UniqueSet();

    seriesResponse.spoken_languages.forEach((value) => {
      spokenLanguages.add({
        languageCode: value.iso_639_1,
      });
    });

    const videos: UniqueSet<PartialVideo> = new UniqueSet();

    seriesResponse.videos.results.forEach((value) => {
      videos.add({
        type: value.type,
        countryCode: value.iso_3166_1,
        languageCode: value.iso_639_1,
        name: value.name,
        id: value.id,
        key: value.key,
        site: value.site,
        size: value.size,
        // @ts-expect-error external api
        official: value["official"] as boolean,
        // @ts-expect-error external api
        publishedDate: moment(value["published_at"]),
      });
    });

    const series: PartialTvSeries = {
      id: seriesResponse.id,
      // @ts-expect-error not present in provided type
      adult: seriesResponse["adult"] as boolean,
      backdropPath: seriesResponse.backdrop_path,
      firstAirDate: moment(seriesResponse.first_air_date).toISOString(),
      homepage: seriesResponse.homepage,
      inProduction: seriesResponse.in_production,
      lastAirDate: seriesResponse.last_air_date
        ? moment(seriesResponse.last_air_date).toISOString()
        : undefined,
      lastEpisodeToAirId: seriesResponse.last_episode_to_air.id,
      name: seriesResponse.name,
      nextEpisodeToAirId: seriesResponse.next_episode_to_air?.id,
      numberOfEpisodes: seriesResponse.number_of_episodes,
      numberOfSeasons: seriesResponse.number_of_seasons,
      originalName: seriesResponse.original_name,
      originalLanguageCode: seriesResponse.original_language,
      overview: seriesResponse.overview,
      popularity: seriesResponse.popularity,
      posterPath: seriesResponse.poster_path,
      status: seriesResponse.status,
      tagline: seriesResponse.tagline,
      type: seriesResponse.type,
      voteAverage: seriesResponse.vote_average,
      voteCount: seriesResponse.vote_count,
      alternativeTitles: [...alternativeTitles],
      cast: [...cast],
      certifications: [...certifications],
      createdBy: [...createdBy],
      crew: [...crew],
      runtimes: [...episodeRunTimes],
      externalIds: [...externalIds],
      genres: [...genres],
      images: [...images],
      keywords: [...keywords],
      languages: [...languages],
      networks: [...networks],
      originCountries: [...originCountries],
      productionCompanies: [...productionCompanies],
      productionCountries: [...productionCountries],
      recommendations: [...recommendations],
      spokenLanguages: [...spokenLanguages],
      videos: [...videos],
    };

    await metadataApi.createTVSeries(series);

    for (const season of seriesResponse.seasons) {
      const seasonKey = `${seriesResponse.id}-${season.season_number}`;
      const seasonFetchJob = await metadataManager.getMetadataFetchJob(
        seasonKey,
        "tv_seasons",
        false,
      );

      if (seasonFetchJob) {
        const now = moment.utc();
        const expirationTime = moment(seasonFetchJob.lastFetchedTime)
          .add(metadataFetchJob.ttl, "days")
          .add(metadataFetchJob.jitter, "minutes");

        if (expirationTime.isAfter(now)) {
          logger.debug(
            `Season ${seasonKey} is fresh... expiration time ${expirationTime.toISOString()}...skipping`,
          );
          continue;
        } else {
          logger.info(`Season ${seasonKey} is expired... re-processing`);
        }
      }

      const ttl = 7;
      const jitter = Math.floor(Math.random() * 3 * 24 * 60);

      await metadataManager.createMetadataFetchJob(
        seasonKey,
        "tv_seasons",
        ttl,
        jitter,
        "queued",
        true,
        { seasons: seriesResponse.seasons.length },
      );
    }

    return [series, undefined];
  }

  protected getTtl(metadata: PartialTvSeries): number {
    if (metadata.lastAirDate) {
      const now = moment.utc();
      // Positive values indicate the episode has aired in the past, negative values indicate the episode is yet
      // to air
      const delta = now.diff(metadata.lastAirDate, "days");

      // If the episode has not aired, check every day, otherwise if it has recently aired (within a month)
      // check every three days.
      if (delta <= 0) {
        return 1;
      } else if (delta < 30) {
        return 3;
      }
    }

    // If there hasn't been a recent;y aired episode but the series is still in production check weekly.
    if (metadata.inProduction) {
      return 7;
    }

    return Math.max(60, Math.floor(Math.random() * 75));
  }

  protected getJitter(metadata: PartialTvSeries): number {
    if (metadata.lastAirDate) {
      const now = moment.utc();
      const delta = now.diff(metadata.lastAirDate, "days");

      if (delta <= 0) {
        return Math.floor(Math.random() * 2 * 24 * 60);
      } else if (delta < 30) {
        return Math.floor(Math.random() * 2 * 24 * 60);
      }
    }

    // If there hasn't been a recent;y aired episode but the series is still in production check weekly.
    if (metadata.inProduction) {
      return Math.floor(Math.random() * 2 * 24 * 60);
    }

    return Math.floor(Math.random() * 60 * 24 * 60);
  }

  protected cleanup(): Promise<void> {
    return Promise.resolve();
  }
}
