import { MovieCastMember, SparseMovieCastMember } from "@ncfritz/olympus-model";
import moment from "moment";
import {
  GraphQlBaseCastMember,
  GraphQlMovieCastMember,
} from "../types/metadata";
import { toBaseDomainObject as toPersonDomainObject } from "../people/converters/PersonConverter";

export const toBaseMovieCastDomainObject = (
  input: GraphQlBaseCastMember,
): SparseMovieCastMember => {
  return {
    castId: input.castId,
    character: input.character,
    createdTime: moment(input.createdTime),
    creditId: input.creditId,
    lastUpdatedTime: moment(input.lastUpdatedTime),
    order: input.order,
    originalName: input.originalName,
  };
};

export const toMovieCastDomainObject = (
  input: GraphQlMovieCastMember,
): MovieCastMember => {
  return {
    ...toBaseMovieCastDomainObject(input),
    person: toPersonDomainObject(input.person),
  };
};
