import {
  BaseTVSeries,
  SparseTvSeries,
  TVSeriesRuntime,
  ExternalId,
  GenreAssociation,
  KeywordAssociation,
  CountryAssociation,
  LanguageAssociation,
  AlternativeTitle,
  TVSeries,
  SparseSeason,
  TypedImage,
  ProductionCompanyAssociation,
  NetworkAssociation,
  CertificationAssociation,
  Video,
  TvSeriesCreatedBy,
  TVSeriesCastMemberRole,
  TVSeriesCastMember,
  TVSeriesCrewMemberJob,
  TVSeriesCrewMember,
} from "@ncfritz/olympus-model";
import moment from "moment";
import {
  GraphQlBaseTvSeries,
  GraphQlSparseTvSeries,
  GraphQlTvSeries,
  GraphQlTvSeriesCastMember,
  GraphQlTvSeriesCastMemberRole,
  GraphQlTvSeriesCreatedBy,
  GraphQlTvSeriesCrewMember,
  GraphQlTvSeriesCrewMemberJob,
  GraphQlTvSeriesRuntime,
} from "../../../types/dionysus/metadata/tvSeries";
import { toDomainObject as toSearchConfigurationDomainObject } from "../media/MediaAssetSearchConfigurationConverter";
import { toSparseDomainObject as toMediaFavoriteDomainObject } from "../media/MediaFavoriteConverter";
import {
  toAlternativeTitleDomainObject,
  toExternalIdDomainObject,
  toTypedImageDomainObject,
  toVideoDomainObject,
} from "./common";
import { toCountryAssociationDomainObject } from "./CountryConverter";
import { toGenreAssociationDomainObject } from "./GenreConverter";
import { toKeywordAssociationDomainObject } from "./KeywordConverter";
import {
  toDomainObject as toLanguageDomainObject,
  toLanguageAssociationDomainObject,
} from "./LanguageConverter";
import { toProductionCompanyAssociationDomainObject } from "./ProductionCompanyConverter";
import { toSparseDomainObject as toEpisodeDomainObject } from "./tvEpisodeConverter";
import { toSparseDomainObject as toSeasonDomainObject } from "./tvSeasonConverter";
import { toBaseDomainObject as toPersonDomainObject } from "./PersonConverter";
import { toCertificationAssociationDomainObject } from "./CertificationConverter";
import { toNetworkAssociationDomainObject } from "./NetworkConverter";

export const toBaseDomainObject = (
  input: GraphQlBaseTvSeries,
): BaseTVSeries => {
  const genres: GenreAssociation[] = [];

  if (input.genres) {
    input.genres.forEach((entity) => {
      if (entity.genre) {
        genres.push(toGenreAssociationDomainObject(entity));
      }
    });
  }

  return {
    adult: input.adult,
    backdropPath: input.backdropPath,
    createdTime: moment(input.createdTime),
    firstAirDate: input.firstAirDate ? moment(input.firstAirDate) : undefined,
    homepage: input.homepage,
    id: input.id,
    inProduction: input.inProduction,
    lastAirDate: input.lastAirDate ? moment(input.lastAirDate) : undefined,
    lastUpdatedTime: moment(input.lastUpdatedTime),
    name: input.name,
    numberOfEpisodes: input.numberOfEpisodes,
    numberOfSeasons: input.numberOfSeasons,
    originalName: input.originalName,
    overview: input.overview,
    popularity: input.popularity,
    posterPath: input.posterPath,
    status: input.status,
    tagline: input.tagline,
    type: input.type,
    voteCount: input.voteCount,
    voteAverage: input.voteAverage,
    genres: genres,
    searchConfiguration: input.searchConfiguration
      ? toSearchConfigurationDomainObject(input.searchConfiguration)
      : undefined,
    favorite: input.favorite
      ? toMediaFavoriteDomainObject(input.favorite)
      : undefined,
  };
};

export const toSparseDomainObject = (
  input: GraphQlSparseTvSeries,
): SparseTvSeries => {
  const alternativeTitles: AlternativeTitle[] = [];
  const certifications: CertificationAssociation[] = [];
  const runtimes: TVSeriesRuntime[] = [];
  const externalIds: ExternalId[] = [];
  const keywords: KeywordAssociation[] = [];
  const languages: LanguageAssociation[] = [];
  const originCountries: CountryAssociation[] = [];
  const spokenLanguages: LanguageAssociation[] = [];

  if (input.alternativeTitles) {
    input.alternativeTitles.forEach((entity) => {
      alternativeTitles.push(toAlternativeTitleDomainObject(entity));
    });
  }

  if (input.certifications) {
    input.certifications.forEach((entity) => {
      if (entity.certification) {
        certifications.push(toCertificationAssociationDomainObject(entity));
      }
    });
  }

  if (input.episodeRuntimes) {
    input.episodeRuntimes.forEach((entity) => {
      runtimes.push(toTvSeriesRuntimeDomainObject(entity));
    });
  }

  if (input.externalIds) {
    input.externalIds.forEach((entity) => {
      externalIds.push(toExternalIdDomainObject(entity));
    });
  }

  if (input.keywords) {
    input.keywords.forEach((entity) => {
      if (entity.keyword) {
        keywords.push(toKeywordAssociationDomainObject(entity));
      }
    });
  }

  if (input.originCountries) {
    input.originCountries.forEach((entity) => {
      if (entity.country) {
        originCountries.push(toCountryAssociationDomainObject(entity));
      }
    });
  }

  if (input.languages) {
    input.languages.forEach((entity) => {
      if (entity.language) {
        languages.push(toLanguageAssociationDomainObject(entity));
      }
    });
  }

  if (input.spokenLanguages) {
    input.spokenLanguages.forEach((entity) => {
      if (entity.language) {
        spokenLanguages.push(toLanguageAssociationDomainObject(entity));
      }
    });
  }

  return {
    ...toBaseDomainObject(input),
    originalLanguage: input.originalLanguage
      ? toLanguageDomainObject(input.originalLanguage)
      : undefined,
    alternativeTitles: alternativeTitles,
    certifications: certifications,
    runtimes: runtimes,
    externalIds: externalIds,
    keywords: keywords,
    languages: languages,
    originCountries: originCountries,
    spokenLanguages: spokenLanguages,
  };
};

export const toDomainObject = (input: GraphQlTvSeries): TVSeries => {
  const createdBy: TvSeriesCreatedBy[] = [];
  const images: TypedImage[] = [];
  const networks: NetworkAssociation[] = [];
  const productionCompanies: ProductionCompanyAssociation[] = [];
  const productionCountries: CountryAssociation[] = [];
  const seasons: SparseSeason[] = [];
  const videos: Video[] = [];

  if (input.createdBy) {
    input.createdBy.forEach((entity) => {
      if (entity.person) {
        createdBy.push(toTvSeriesCreatedBy(entity));
      }
    });
  }

  if (input.images) {
    input.images.forEach((entity) => {
      images.push(toTypedImageDomainObject(entity));
    });
  }

  if (input.networks) {
    input.networks.forEach((entity) => {
      if (entity.network) {
        networks.push(toNetworkAssociationDomainObject(entity));
      }
    });
  }

  if (input.productionCompanies) {
    input.productionCompanies.forEach((entity) => {
      if (entity.productionCompany) {
        productionCompanies.push(
          toProductionCompanyAssociationDomainObject(entity),
        );
      }
    });
  }

  if (input.productionCountries) {
    input.productionCountries.forEach((entity) => {
      if (entity.country) {
        productionCountries.push(toCountryAssociationDomainObject(entity));
      }
    });
  }

  if (input.seasons) {
    input.seasons.forEach((entity) => {
      seasons.push(toSeasonDomainObject(entity));
    });
  }

  if (input.videos) {
    input.videos.forEach((entity) => {
      videos.push(toVideoDomainObject(entity));
    });
  }

  return {
    ...toSparseDomainObject(input),
    lastEpisodeToAir: input.lastEpisodeToAir
      ? toEpisodeDomainObject(input.lastEpisodeToAir)
      : undefined,
    nextEpisodeToAir: input.nextEpisodeToAir
      ? toEpisodeDomainObject(input.nextEpisodeToAir)
      : undefined,
    createdBy: createdBy,
    images: images,
    networks: networks,
    productionCompanies: productionCompanies,
    productionCountries: productionCountries,
    seasons: seasons,
    videos: videos,
  };
};

const toTvSeriesRuntimeDomainObject = (
  input: GraphQlTvSeriesRuntime,
): TVSeriesRuntime => {
  return {
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    runTime: input.runTime,
  };
};

const toTvSeriesCreatedBy = (
  input: GraphQlTvSeriesCreatedBy,
): TvSeriesCreatedBy => {
  return {
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    creditId: input.creditId,
    person: toPersonDomainObject(input.person),
  };
};

const toTvSeriesCastMemberRole = (
  input: GraphQlTvSeriesCastMemberRole,
): TVSeriesCastMemberRole => {
  return {
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    character: input.character,
    creditId: input.creditId,
    episodeCount: input.episodeCount,
  };
};

export const toTvSeriesCastMember = (
  input: GraphQlTvSeriesCastMember,
): TVSeriesCastMember => {
  const roles: TVSeriesCastMemberRole[] = [];

  if (input.roles) {
    input.roles.forEach((entity) => {
      roles.push(toTvSeriesCastMemberRole(entity));
    });
  }

  return {
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    order: input.order,
    originalName: input.originalName,
    totalEpisodeCount: input.totalEpisodeCount,
    person: toPersonDomainObject(input.person),
    roles: roles,
  };
};

const toTvSeriesCrewMemberJob = (
  input: GraphQlTvSeriesCrewMemberJob,
): TVSeriesCrewMemberJob => {
  return {
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    job: input.job,
    creditId: input.creditId,
    episodeCount: input.episodeCount,
  };
};

export const toTvSeriesCrewMember = (
  input: GraphQlTvSeriesCrewMember,
): TVSeriesCrewMember => {
  const jobs: TVSeriesCrewMemberJob[] = [];

  if (input.jobs) {
    input.jobs.forEach((entity) => {
      jobs.push(toTvSeriesCrewMemberJob(entity));
    });
  }

  return {
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    department: input.department,
    originalName: input.originalName,
    totalEpisodeCount: input.totalEpisodeCount,
    person: toPersonDomainObject(input.person),
    jobs: jobs,
  };
};
