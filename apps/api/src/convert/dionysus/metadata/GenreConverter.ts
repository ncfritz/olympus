import { Genre, GenreAssociation } from "@ncfritz/olympus-model";
import moment from "moment";
import {
  GraphQlGenre,
  GraphQlGenreWrapper,
} from "../../../types/dionysus/metadata/genre";

export const toDomainObject = (input: GraphQlGenre): Genre => {
  return {
    id: input.id,
    name: input.name,
    type: input.type,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
  };
};

export const toGenreAssociationDomainObject = (
  input: GraphQlGenreWrapper,
): GenreAssociation => {
  return {
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    genre: toDomainObject(input.genre),
  };
};
