export const BASE_CERTIFICATION = `country
  certification
  type
  order
  meaning
  createdTime
  lastUpdatedTime
  `;

export const CERTIFICATION_ASSOCIATION = `certification {
    ${BASE_CERTIFICATION}
  }
  createdTime
  lastUpdatedTime 
  `;

export const CERTIFICATIONS = `certifications {
    ${CERTIFICATION_ASSOCIATION}
  }`;
