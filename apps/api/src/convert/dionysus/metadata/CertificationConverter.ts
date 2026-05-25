import {
  Certification,
  CertificationAssociation,
} from "@ncfritz/olympus-model";
import moment from "moment";
import {
  GraphQlCertification,
  GraphQlCertificationWrapper,
} from "../../../types/dionysus/metadata/certification";

export const toDomainObject = (input: GraphQlCertification): Certification => {
  return {
    country: input.country,
    certification: input.certification,
    type: input.type,
    order: input.order,
    meaning: input.meaning,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
  };
};

export const toCertificationAssociationDomainObject = (
  input: GraphQlCertificationWrapper,
): CertificationAssociation => {
  return {
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    certification: toDomainObject(input.certification),
  };
};
