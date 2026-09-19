import type {
  PartialAlternativeTitle,
  PartialCountryAssociation,
  PartialExternalId,
  PartialGenreAssociation,
  PartialKeywordAssociation,
  PartialLanguageAssociation,
  PartialMovie,
  PartialMovieCastMember,
  PartialMovieCrewMember,
  PartialMovieRecommendation,
  PartialMovieReleaseDate,
  PartialProductionCompanyAssociation,
  PartialTypedImage,
  PartialVideo,
} from "@ncfritz/olympus-sdk/dionysus";
import moment from "moment";
import { MOVIE_ID_TYPES } from "./externalIds";
import { UniqueSet } from "./UniqueSet";
import type { TmdbClient } from "../../tmdb/services/TmdbClient";

/** Maps TMDB's responses for a movie to the API entity. */
export const toMovie = (
  movieResponse: Awaited<ReturnType<TmdbClient["getMovieDetails"]>>,
  recommendationsResponse: Awaited<
    ReturnType<TmdbClient["getMovieRecommendations"]>
  >,
): PartialMovie => {
  const recommendations: UniqueSet<PartialMovieRecommendation> =
    new UniqueSet();

  recommendationsResponse.results.forEach((value) => {
    recommendations.add({
      recommendationId: value.id,
    });
  });

  const alternativeTitles: UniqueSet<PartialAlternativeTitle> = new UniqueSet();

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

  const externalIds: UniqueSet<PartialExternalId> = new UniqueSet();

  if (movieResponse.external_ids) {
    Object.entries(MOVIE_ID_TYPES).forEach(([idType, idName]) => {
      if (movieResponse.external_ids[idType as never]) {
        externalIds.add({
          type: idName,
          externalId: `${movieResponse.external_ids[idType as never]}`,
        });
      }
    });
  }

  const genres: UniqueSet<PartialGenreAssociation> = new UniqueSet();

  movieResponse.genres.forEach((value) => {
    genres.add({
      genreId: value.id,
    });
  });

  const images: UniqueSet<PartialTypedImage> = new UniqueSet();

  movieResponse.images.logos.forEach((value) => {
    images.add({
      type: "logo",
      filePath: value.file_path,
      width: value.width,
      height: value.height,
      languageCode: value.iso_639_1 || "en",
    });
  });

  movieResponse.images.backdrops.forEach((value) => {
    images.add({
      type: "backdrop",
      filePath: value.file_path,
      width: value.width,
      height: value.height,
      languageCode: value.iso_639_1 || "en",
    });
  });

  movieResponse.images.posters.forEach((value) => {
    images.add({
      type: "poster",
      filePath: value.file_path,
      width: value.width,
      height: value.height,
      languageCode: value.iso_639_1 || "en",
    });
  });

  const keywords: UniqueSet<PartialKeywordAssociation> = new UniqueSet();

  movieResponse.keywords.keywords.forEach((value) => {
    keywords.add({
      keywordId: value.id,
    });
  });

  const productionCompanies: UniqueSet<PartialProductionCompanyAssociation> =
    new UniqueSet();

  movieResponse.production_companies.forEach((value) => {
    productionCompanies.add({
      productionCompanyId: value.id,
    });
  });

  const productionCountries: UniqueSet<PartialCountryAssociation> =
    new UniqueSet();

  movieResponse.production_countries.forEach((value) => {
    productionCountries.add({
      countryCode: value.iso_3166_1,
    });
  });

  const releaseDates: UniqueSet<PartialMovieReleaseDate> = new UniqueSet();

  movieResponse.release_dates.results.forEach((wrapper) => {
    const countryCode = wrapper.iso_3166_1;

    wrapper.release_dates.forEach((value) => {
      releaseDates.add({
        type: value.type,
        countryCode: countryCode,
        releaseDate: moment(value.release_date).toISOString(),
        languageCode: value.iso_639_1,
        certificationId: value.certification,
        note: value.note,
      });
    });
  });

  const spokenLanguages: UniqueSet<PartialLanguageAssociation> =
    new UniqueSet();

  movieResponse.spoken_languages.forEach((value) => {
    spokenLanguages.add({
      languageCode: value.iso_639_1,
    });
  });

  const videos: UniqueSet<PartialVideo> = new UniqueSet();

  movieResponse.videos.results.forEach((value) => {
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

  const movie: PartialMovie = {
    id: movieResponse.id,
    adult: movieResponse.adult,
    backdropPath: movieResponse.backdrop_path,
    budget: movieResponse.budget,
    homepage: movieResponse.homepage,
    imdbId: movieResponse.imdb_id || undefined,
    originalLanguageCode: movieResponse.original_language,
    originalTitle: movieResponse.original_title,
    overview: movieResponse.overview,
    popularity: movieResponse.popularity,
    posterPath: movieResponse.poster_path,
    releaseDate: moment(movieResponse.release_date).toISOString(),
    revenue: movieResponse.revenue,
    runtime: movieResponse.runtime,
    status: movieResponse.status,
    tagline: movieResponse.tagline,
    title: movieResponse.title,
    video: movieResponse.video,
    voteAverage: movieResponse.vote_average,
    voteCount: movieResponse.vote_count,
    alternativeTitles: [...alternativeTitles],
    cast: [...cast],
    crew: [...crew],
    externalIds: [...externalIds],
    genres: [...genres],
    images: [...images],
    keywords: [...keywords],
    productionCompanies: [...productionCompanies],
    productionCountries: [...productionCountries],
    recommendations: [...recommendations],
    releaseDates: [...releaseDates],
    spokenLanguages: [...spokenLanguages],
    videos: [...videos],
  };

  return movie;
};
