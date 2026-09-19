import {
  GraphQlExternalId,
  GraphQlIdentifiableImage,
  Timestamped,
  Wrapped,
} from "../../types/metadata";

export type GraphQlBasePerson = Timestamped & {
  adult: boolean;
  birthday?: string;
  birthplace?: string;
  deathday?: string;
  gender: number;
  homepage: string;
  id: number;
  imdbId: string;
  knownForDepartment: string;
  name: string;
  profilePath?: string;
  popularity: number;
};

export type GraphQlPerson = GraphQlBasePerson & {
  alsoKnownAs: GraphQlAlsoKnownAs[];
  biography: string;
  externalIds: GraphQlExternalId[];
  images: GraphQlIdentifiableImage[];
};

export type GraphQlAlsoKnownAs = Timestamped & {
  name: string;
};

export type GraphQlPersonWrapper = Timestamped &
  Wrapped<GraphQlPerson, "person">;
