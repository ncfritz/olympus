import { MovieCastMember } from "@ncfritz/olympus-model";
import moment from "moment";
import { GraphQlMovieCastMember } from "../../types/dionysus/metadata";
import { toDomainObject as toPersonDomainObject } from "./PersonConverter";

export const toMovieCastDomainObject = (
  input: GraphQlMovieCastMember,
): MovieCastMember => {
  return {
    castId: input.castId,
    character: input.character,
    createdTime: moment(input.createdTime),
    creditId: input.creditId,
    lastUpdatedTime: moment(input.lastUpdatedTime),
    order: input.order,
    originalName: input.originalName,
    person: toPersonDomainObject(input.person),
  };
};
