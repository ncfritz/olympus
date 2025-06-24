import {
  GraphQlCertification,
  GraphQlCountry,
  GraphQlCountryWrapper,
  GraphQlGenreWrapper,
  GraphQlKeywordWrapper,
  GraphQlLanguage,
  GraphQlLanguageWrapper,
} from "../batchJobs";

export type GraphQlMovie = {
  adult: boolean;
  backdropPath?: string;
  budget: number;
  createdTime: string;
  homepage: string;
  id: number;
  imdbId?: string;
  lastUpdatedTime: string;
  originalTitle: string;
  overview: string;
  posterPath?: string;
  releaseDate?: string;
  revenue: number;
  runtime: number;
  status: string;
  tagline: string;
  title: string;
  video: boolean;
  alternativeTitles: GraphQlAlternativeTitle[];
  cast: GraphQlMovieCastMember[];
  crew: GraphQlMovieCrewMember[];
  externalIds: GraphQlExternalId[];
  genres: GraphQlGenreWrapper[];
  images: GraphQlMovieImage[];
  keywords: GraphQlKeywordWrapper[];
  productionCountries: GraphQlCountryWrapper[];
  productionCompanies: GraphQlMovieProductionCompanyWrapper[];
  originalLanguage: GraphQlLanguage;
  releaseDates: GraphQlReleaseDate[];
  spokenLanguages: GraphQlLanguageWrapper[];
  videos: GraphQlMovieVideo[];
};

export type GraphQlAlternativeTitle = Timestamped & {
  country: GraphQlCountry;
  title: string;
  type: string;
};

export type GraphQlAlternativeName = Timestamped & {
  name: string;
  type: string;
};

export type GraphQlBaseCastOrCrewMember = Timestamped & {
  creditId: string;
  originalName: string;
  person: GraphQlPerson;
};

export type GraphQlBaseCastMember = GraphQlBaseCastOrCrewMember & {
  castId: number;
  character: string;
  order: number;
};
export type GraphQlMovieCastMember = GraphQlBaseCastMember & {};

export type GraphQlBaseCrewMember = GraphQlBaseCastOrCrewMember & {
  job: string;
  department: string;
};
export type GraphQlMovieCrewMember = GraphQlBaseCrewMember & {};

export type GraphQlPerson = Timestamped & {
  adult: boolean;
  alsoKnownAs: GraphQlAlsoKnownAs[];
  biography: string;
  birthday?: string;
  birthplace?: string;
  deathday?: string;
  externalIds: GraphQlExternalId[];
  gender: number;
  homepage: string;
  id: number;
  images: GraphQlImage[];
  imdbId: string;
  knownForDepartment: string;
  name: string;
  profilePath?: string;
};

export type GraphQlAlsoKnownAs = Timestamped & {
  name: string;
};

export type GraphQlExternalId = Timestamped & {
  externalId: string;
  type: string;
};

export type GraphQlImage = Timestamped & {
  filePath: string;
  height: number;
  width: number;
  language: GraphQlLanguage;
};

export type GraphQlMovieImage = GraphQlImage & {
  type: string;
};

export type GraphQlReleaseDate = Timestamped & {
  certification: GraphQlCertification;
  country: GraphQlCountry;
  language: GraphQlLanguage;
  note: string;
  releaseDate: string;
  type: number;
};

export type GraphQlMovieVideo = Timestamped & {
  country: GraphQlCountry;
  id: string;
  key: string;
  language: GraphQlLanguage;
  name: string;
  official: boolean;
  publishedTime: string;
  site: string;
  size: number;
  type: string;
};

export type GraphQlProductionCompanyBase = Timestamped & {
  alternativeNames: GraphQlAlternativeName[];
  country: GraphQlCountry;
  description: string;
  headquarters: string;
  homepage: string;
  id: number;
  logo: string;
  name: string;
};

export type Timestamped = {
  createdTime: string;
  lastUpdatedTime: string;
};

export type Wrapped<T, PropertyName extends string> = {
  [P in PropertyName]: T;
};

export type GraphQlMovieProductionCompanyWrapper = Timestamped &
  Wrapped<GraphQlProductionCompanyBase, "productionCompany">;
