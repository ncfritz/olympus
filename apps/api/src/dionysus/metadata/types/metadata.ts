import { GraphQlCertification } from "../certifications/types/certification";
import { GraphQlCountry } from "../countries/types/country";
import { GraphQlLanguage } from "../languages/types/language";
import { GraphQlSparseMovie } from "../movies/types/movie";
import { GraphQlBasePerson } from "../people/types/person";

export type GraphQlAlternativeTitle = Timestamped & {
  country: GraphQlCountry | null;
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
};

export type GraphQlBaseCastMember = GraphQlBaseCastOrCrewMember & {
  castId: number;
  character: string;
  order: number;
};
export type GraphQlMovieCastMember = GraphQlBaseCastMember & {
  person: GraphQlBasePerson;
};

export type GraphQlBaseCrewMember = GraphQlBaseCastOrCrewMember & {
  job: string;
  department: string;
};
export type GraphQlMovieCrewMember = GraphQlBaseCrewMember & {
  person: GraphQlBasePerson;
};

export type GraphQlExternalId = Timestamped & {
  externalId: string;
  type: string;
};

export type GraphQlImage = Timestamped & {
  filePath: string;
  height: number;
  width: number;
};

export type GraphQlTypedImage = GraphQlImage & {
  type: string;
  language: GraphQlLanguage | null;
};

export type GraphQlIdentifiableImage = GraphQlImage & {
  id: string;
  fileType: string;
};

export type GraphQlReleaseDate = Timestamped & {
  certification: GraphQlCertification | null;
  country: GraphQlCountry | null;
  language: GraphQlLanguage | null;
  note: string;
  releaseDate: string;
  type: number;
};

export type GraphQlVideo = Timestamped & {
  country: GraphQlCountry | null;
  id: string;
  key: string;
  language: GraphQlLanguage | null;
  name: string;
  official: boolean;
  publishedDate: string;
  site: string;
  size: number;
  type: string;
};

export type GraphQlCollection = Timestamped & {
  backdropPath: string;
  id: number;
  name: string;
  overview: string;
  posterPath: string;
  images: GraphQlTypedImage[];
  parts: GraphQlCollectionPart[];
};

export type GraphQlCollectionPart = Timestamped & {
  movie: GraphQlSparseMovie;
};

export type GraphQlPersonMovieCastCredit = GraphQlBaseCastMember & {
  movie: GraphQlSparseMovie;
};

export type GraphQlPersonMovieCrewCredit = GraphQlBaseCrewMember & {
  movie: GraphQlSparseMovie;
};

export type Timestamped = {
  createdTime: string;
  lastUpdatedTime: string;
};

export type Wrapped<T, PropertyName extends string> = {
  [P in PropertyName]: T;
};
