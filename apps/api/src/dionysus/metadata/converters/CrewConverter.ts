import { MovieCrewMember, SparseMovieCrewMember } from "@ncfritz/olympus-model";
import moment from "moment";
import {
  GraphQlBaseCrewMember,
  GraphQlMovieCrewMember,
} from "../types/metadata";
import { toBaseDomainObject as toPersonDomainObject } from "../people/converters/PersonConverter";

export const toBaseMovieCrewDomainObject = (
  input: GraphQlBaseCrewMember,
): SparseMovieCrewMember => {
  return {
    createdTime: moment(input.createdTime),
    creditId: input.creditId,
    department: input.department,
    job: input.job,
    lastUpdatedTime: moment(input.lastUpdatedTime),
    originalName: input.originalName,
  };
};

export const toMovieCrewDomainObject = (
  input: GraphQlMovieCrewMember,
): MovieCrewMember => {
  return {
    ...toBaseMovieCrewDomainObject(input),
    person: toPersonDomainObject(input.person),
  };
};
