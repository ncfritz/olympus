import { ALTERNATIVE_NAMES, BASE_COUNTRY, IDENTIFIABLE_IMAGE } from "./common";

export const BASE_NETWORK = `id
  name
  headquarters
  homepage
  logo`;

export const NETWORK = `${BASE_NETWORK}
  createdTime
  lastUpdatedTime
  ${ALTERNATIVE_NAMES}
  ${IDENTIFIABLE_IMAGE}
  country {
    ${BASE_COUNTRY}
  }`;

export const NETWORK_WITH_CONTENT_COUNTS = `${NETWORK}`;

export const NETWORK_ASSOCIATION = `createdTime
  lastUpdatedTime
  network {
    ${NETWORK}
  }`;

export const NETWORKS = `networks {
    ${NETWORK_ASSOCIATION}
  }`;
