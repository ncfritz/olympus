import { MovieCrewMember } from "@ncfritz/olympus-model";
import moment from "moment";
import { GraphQlMovieCrewMember } from "../../types/dionysus/metadata";
import { toDomainObject as toPersonDomainObject } from "./PersonConverter";

export const toMovieCrewDomainObject = (
  input: GraphQlMovieCrewMember,
): MovieCrewMember => {
  return {
    createdTime: moment(input.createdTime),
    creditId: input.creditId,
    department: input.department,
    job: input.job,
    lastUpdatedTime: moment(input.lastUpdatedTime),
    originalName: input.originalName,
    person: toPersonDomainObject(input.person),
  };
};
