import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import {
  CertificationType,
  JobType,
  MetadataFetchJob,
  MetadataFetchJobStatus,
  PartialTVSeries,
  PartialTVSeriesAlternativeTitle,
  PartialTVSeriesCastMember,
  PartialTVSeriesCertification,
  PartialTVSeriesCountry,
  PartialTVSeriesCrewMember,
  PartialTVSeriesExternalId,
  PartialTVSeriesGenre,
  PartialTVSeriesImage,
  PartialTVSeriesKeyword,
  PartialTVSeriesLanguage,
  PartialTVSeriesNetwork,
  PartialTVSeriesProductionCompany,
  PartialTVSeriesRuntime,
  PartialTVSeriesSpokenLanguage,
  PartialTVSeriesVideo,
} from "@ncfritz/olympus-model";
import { Injectable } from "@nestjs/common";
import { ConsumeMessage } from "amqplib";
import moment from "moment/moment";
import { AggregateCast, AggregateCrew } from "tmdb-ts";
import { TvShowsEndpoint } from "tmdb-ts/dist/endpoints";
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
export class TVSeriesMetadataHandler extends BaseMetadataHandler<
  PartialTVSeries,
  undefined
> {
  @RabbitSubscribe({
    exchange: `${METADATA_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${METADATA_JOB_PREFIX}.${JobType.TV_SERIES}.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.${JobType.TV_SERIES}`,
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    metadataFetchJob: MetadataFetchJob,
  ): Promise<[PartialTVSeries, undefined]> {
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

    const series = new PartialTVSeries();
    series.id = seriesResponse.id;
    // @ts-expect-error not present in provided type
    series.adult = seriesResponse["adult"] as boolean;
    series.backdropPath = seriesResponse.backdrop_path;
    series.firstAirDate = moment(seriesResponse.first_air_date);
    series.homepage = seriesResponse.homepage;
    series.inProduction = seriesResponse.in_production;
    series.lastAirDate = moment(seriesResponse.last_air_date);
    // last episode to air
    series.name = seriesResponse.name;
    series.numberOfEpisodes = seriesResponse.number_of_episodes;
    series.numberOfSeasons = seriesResponse.number_of_seasons;
    series.originalName = seriesResponse.original_name;
    series.originalLanguageCode = seriesResponse.original_language;
    series.overview = seriesResponse.overview;
    series.posterPath = seriesResponse.poster_path;
    series.status = seriesResponse.status;
    series.tagline = seriesResponse.tagline;
    series.type = seriesResponse.type;

    const alternativeTitles: UniqueSet<PartialTVSeriesAlternativeTitle> =
      new UniqueSet();

    // @ts-expect-error API bindings incorrect
    seriesResponse.alternative_titles.results.forEach((value) => {
      alternativeTitles.add({
        title: value.title,
        type: value.type,
        countryCode: value.iso_3166_1,
      });
    });

    const cast: UniqueSet<PartialTVSeriesCastMember> = new UniqueSet();

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

    const certifications: UniqueSet<PartialTVSeriesCertification> =
      new UniqueSet();

    seriesResponse.content_ratings.results.forEach((value) => {
      certifications.add({
        certification: value.rating,
        type: CertificationType.TV,
        country: value.iso_3166_1,
      });
    });

    const crew: UniqueSet<PartialTVSeriesCrewMember> = new UniqueSet();

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

    const episodeRunTimes: UniqueSet<PartialTVSeriesRuntime> = new UniqueSet();

    seriesResponse.episode_run_time.forEach((value) => {
      episodeRunTimes.add({
        runTime: value,
      });
    });

    const externalIds: UniqueSet<PartialTVSeriesExternalId> = new UniqueSet();

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

    const genres: UniqueSet<PartialTVSeriesGenre> = new UniqueSet();

    seriesResponse.genres.forEach((value) => {
      genres.add({
        genreId: value.id,
      });
    });

    const images: UniqueSet<PartialTVSeriesImage> = new UniqueSet();

    seriesResponse.images.logos.forEach((value) => {
      images.add({
        type: "logo",
        filePath: value.file_path,
        width: value.width,
        height: value.height,
        countryCode: value.iso_639_1 || "en",
      });
    });

    seriesResponse.images.backdrops.forEach((value) => {
      images.add({
        type: "backdrop",
        filePath: value.file_path,
        width: value.width,
        height: value.height,
        countryCode: value.iso_639_1 || "en",
      });
    });

    seriesResponse.images.posters.forEach((value) => {
      images.add({
        type: "poster",
        filePath: value.file_path,
        width: value.width,
        height: value.height,
        countryCode: value.iso_639_1 || "en",
      });
    });

    const keywords: UniqueSet<PartialTVSeriesKeyword> = new UniqueSet();

    // @ts-expect-error - expected per API - TS bindings are incorrect
    seriesResponse.keywords.results.forEach((value) => {
      keywords.add({
        keywordId: value.id,
      });
    });

    const languages: UniqueSet<PartialTVSeriesLanguage> = new UniqueSet();

    seriesResponse.languages.forEach((value) => {
      languages.add({
        languageCode: value,
      });
    });

    const networks: UniqueSet<PartialTVSeriesNetwork> = new UniqueSet();

    seriesResponse.networks.forEach((value) => {
      networks.add({
        networkId: value.id,
      });
    });

    const originCountries: UniqueSet<PartialTVSeriesCountry> = new UniqueSet();

    seriesResponse.origin_country.forEach((value) => {
      originCountries.add({
        countryCode: value,
      });
    });

    const productionCompanies: UniqueSet<PartialTVSeriesProductionCompany> =
      new UniqueSet();

    seriesResponse.production_companies.forEach((value) => {
      productionCompanies.add({
        productionCompanyId: value.id,
      });
    });

    const productionCountries: UniqueSet<PartialTVSeriesCountry> =
      new UniqueSet();

    seriesResponse.production_countries.forEach((value) => {
      productionCountries.add({
        countryCode: value.iso_3166_1,
      });
    });

    const spokenLanguages: UniqueSet<PartialTVSeriesSpokenLanguage> =
      new UniqueSet();

    seriesResponse.spoken_languages.forEach((value) => {
      spokenLanguages.add({
        languageCode: value.iso_639_1,
      });
    });

    const videos: UniqueSet<PartialTVSeriesVideo> = new UniqueSet();

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

    series.alternativeTitles = [...alternativeTitles];
    series.cast = [...cast];
    series.certifications = [...certifications];
    series.crew = [...crew];
    series.runtimes = [...episodeRunTimes];
    series.externalIds = [...externalIds];
    series.genres = [...genres];
    series.images = [...images];
    series.keywords = [...keywords];
    series.languages = [...languages];
    series.networks = [...networks];
    series.originCountries = [...originCountries];
    series.productionCompanies = [...productionCompanies];
    series.productionCountries = [...productionCountries];
    series.spokenLanguages = [...spokenLanguages];
    series.videos = [...videos];

    await metadataApi.createTVSeries(series);

    for (const season of seriesResponse.seasons) {
      const ttl = 7;
      const jitter = Math.floor(Math.random() * 3 * 24 * 60);

      await metadataApi.createMetadataFetchJob(
        `${seriesResponse.id}-${season.season_number}`,
        JobType.TV_SEASONS,
        ttl,
        jitter,
        MetadataFetchJobStatus.QUEUED,
        true,
        { seasons: seriesResponse.seasons.length },
      );
    }

    return [series, undefined];
  }

  protected getTtl(metadata: PartialTVSeries): number {
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

  protected getJitter(metadata: PartialTVSeries): number {
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
