import {
  ALTERNATIVE_NAMES,
  BASE_COUNTRY,
  IDENTIFIABLE_IMAGE,
} from "../../queries/common";

export const BASE_PRODUCTION_COMPANY = `id
  name
  description
  headquarters
  homepage
  logo`;

export const SPARSE_PRODUCTION_COMPANY = `${BASE_PRODUCTION_COMPANY}
  createdTime
  lastUpdatedTime
  ${ALTERNATIVE_NAMES}
  country {
    ${BASE_COUNTRY}
  }
  `;

export const SPARSE_PRODUCTION_COMPANY_WITH_CONTENT_COUNTS = `${SPARSE_PRODUCTION_COMPANY}`;

export const PRODUCTION_COMPANY = `${SPARSE_PRODUCTION_COMPANY}
  logos {
    ${IDENTIFIABLE_IMAGE}
  }`;

export const FULL_PRODUCTION_COMPANY = `${PRODUCTION_COMPANY}
  parent {
    ${SPARSE_PRODUCTION_COMPANY}
  }
  children {
    ${SPARSE_PRODUCTION_COMPANY}
  }`;

export const PRODUCTION_COMPANY_ASSOCIATION = `createdTime
  lastUpdatedTime
  productionCompany {
    ${SPARSE_PRODUCTION_COMPANY}
  }`;

export const PRODUCTION_COMPANIES = `productionCompanies {
    ${PRODUCTION_COMPANY_ASSOCIATION}
  }`;
