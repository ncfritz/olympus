import { Genre, MovieGenre } from "@ncfritz/olympus-model";
import moment from "moment/moment";
import { GraphQlGenre, GraphQlGenreWrapper } from "../../types/batchJobs";

export const toDomainObject = (input: GraphQlGenre): Genre => {
  return {
    id: input.id,
    name: input.name,
    type: input.type,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
  };
};

export const toMovieGenreDomainObject = (
  input: GraphQlGenreWrapper,
): MovieGenre => {
  return {
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    genre: toDomainObject(input.genre),
  };
};
